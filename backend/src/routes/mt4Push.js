const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { getBridgeToken, receiveMT4Push, eaAutoRegister } = require('../controllers/mt4PushController');
const { authenticateToken } = require('../middleware/auth');

const { requireAdmin } = require('../middleware/auth');

// Dedicated rate limiter for EA push — allows up to 200 accounts per VPS per 15 min window
// (200 accounts × 3 pushes/15min = 600, but 200 is safe headroom)
const eaPushLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: 'Too many push requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/mt4/token?login=xxx&server=xxx  (any authenticated user — controller validates ownership)
router.get('/token', authenticateToken, getBridgeToken);

// POST /api/mt4/push  (authenticated via bridge token, NOT user JWT)
router.post('/push', eaPushLimiter, receiveMT4Push);

// POST /api/mt4/ea-autoregister  (authenticated via EA_SECRET, no user JWT needed)
router.post('/ea-autoregister', eaAutoRegister);

module.exports = router;
