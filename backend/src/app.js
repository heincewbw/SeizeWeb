require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const logger = require('./config/logger');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const positionRoutes = require('./routes/positions');
const statsRoutes = require('./routes/stats');
const mt4PushRoutes = require('./routes/mt4Push');
const withdrawalRoutes = require('./routes/withdrawals');
const adminRoutes = require('./routes/admin');
const supabase = require('./config/supabase');
const { startMT4Monitor } = require('./jobs/mt4Monitor');

const app = express();
const server = http.createServer(app);

// ─── CORS origin helper ─────────────────────────────────────────────────────
const getAllowedOrigin = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || true; // true = same-origin in prod
  }
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

// ─── WebSocket (Socket.IO) ──────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: getAllowedOrigin(),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (user: ${socket.userId})`);
  socket.join(`user:${socket.userId}`);

  socket.on('subscribe_account', ({ accountId }) => {
    socket.join(`account:${accountId}`);
    logger.debug(`Socket ${socket.id} subscribed to account ${accountId}`);
  });

  socket.on('unsubscribe_account', ({ accountId }) => {
    socket.leave(`account:${accountId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(cors({
  origin: getAllowedOrigin(),
  credentials: true,
}));
app.use(express.json({ limit: '5mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// JSON parse error handler - log snippet around error position
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    const m = err.message.match(/position (\d+)/);
    if (m && req.rawBody) {
      const pos = parseInt(m[1]);
      const start = Math.max(0, pos - 80);
      const end = Math.min(req.rawBody.length, pos + 80);
      const snippet = req.rawBody.slice(start, end).toString('utf8');
      const bytes = Array.from(req.rawBody.slice(Math.max(0, pos - 5), pos + 5))
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
      logger.error(`JSON parse error at pos ${pos}. Snippet: ${JSON.stringify(snippet)} | Bytes near: ${bytes}`);
    }
  }
  next(err);
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' },
});
app.use('/auth/', authLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/mt4', mt4PushRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'SeizeWeb API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Serve Frontend Static (Production) ─────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  // SPA fallback — any non-API route serves index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 handler (only reached in development or for API routes not found)
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error(`Unhandled error [${status}]:`, err.message || err);

  // For JSON parse errors on /api/mt4/push, include snippet in response so EA can log it
  if (err.type === 'entity.parse.failed' && req.rawBody && req.path === '/api/mt4/push') {
    const m = err.message.match(/position (\d+)/);
    let detail = err.message;
    if (m) {
      const pos = parseInt(m[1]);
      const start = Math.max(0, pos - 200);
      const end = Math.min(req.rawBody.length, pos + 30);
      const snippet = req.rawBody.slice(start, end).toString('utf8').replace(/[\r\n]/g, '?');
      const hex = Array.from(req.rawBody.slice(Math.max(0, pos - 3), pos + 3))
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
      detail = `pos=${pos} hex=[${hex}] before=${snippet}`;
    }
    return res.status(400).json({ error: detail });
  }

  res.status(status).json({
    error: status === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Unknown error',
  });
});

// ─── Real-time Sync (every 30 seconds) ──────────────────────────────────────
const startRealtimeSync = async () => {
  setInterval(async () => {
    try {
      const { data: accounts } = await supabase
        .from('mt4_accounts')
        .select('id, login, server, user_id')
        .eq('is_connected', true);

      if (!accounts || accounts.length === 0) return;

      // Data is pushed by EA via /api/mt4/push — no polling needed here
      for (const account of accounts) {
        const { positionCache } = require('./controllers/mt4PushController');
        const cacheKey = `${account.login}:${account.server}`;
        const cached = positionCache.get(cacheKey);
        if (cached) {
          io.to(`account:${account.id}`).emit('positions_update', {
            accountId: account.id,
            positions: cached.positions,
          });
        }
      }
    } catch (err) {
      logger.error('Realtime sync error:', err);
    }
  }, 30000);
};

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`SeizeWeb API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  startRealtimeSync();
  startMT4Monitor();
});

module.exports = { app, server, io };
