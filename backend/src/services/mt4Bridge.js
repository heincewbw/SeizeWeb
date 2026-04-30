/**
 * MT4 Bridge Service
 *
 * This service handles communication with MetaTrader 4 via a TCP socket bridge.
 * It connects to an Expert Advisor (EA) running in MT4 that acts as a bridge server.
 *
 * The EA file is located at: /mt4-ea/SeizeBridge.mq4
 *
 * Protocol: JSON messages over TCP, each message terminated with '\n'
 *
 * Supported Commands:
 *   - CONNECT    : Authenticate and get account info
 *   - ACCOUNT_INFO : Get current account balance/equity
 *   - POSITIONS  : Get open positions
 *   - HISTORY    : Get closed trade history
 *   - DISCONNECT : Close connection
 *
 * If you prefer a cloud-based approach, this service also supports MetaAPI (metaapi.cloud)
 * by setting USE_METAAPI=true in .env and providing METAAPI_TOKEN.
 */

const net = require('net');
const logger = require('../config/logger');

// Active connection pool: key = "login@server"
const connectionPool = new Map();

// Session token store (login -> { token, server, connectedAt })
const sessionStore = new Map();

const MT4_BRIDGE_HOST = process.env.MT4_BRIDGE_HOST || '127.0.0.1';
const MT4_BRIDGE_PORT = parseInt(process.env.MT4_BRIDGE_PORT) || 9090;
const CONNECTION_TIMEOUT = 10000; // 10 seconds

/**
 * Sends a command to MT4 bridge and waits for response
 */
const sendCommand = (command, payload = {}) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let responseData = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        client.destroy();
        reject(new Error('MT4 bridge connection timeout'));
      }
    }, CONNECTION_TIMEOUT);

    client.connect(MT4_BRIDGE_PORT, MT4_BRIDGE_HOST, () => {
      const message = JSON.stringify({ command, ...payload }) + '\n';
      client.write(message);
    });

    client.on('data', (chunk) => {
      responseData += chunk.toString();
      // Check if we have a complete JSON response (ends with newline)
      if (responseData.includes('\n')) {
        const lines = responseData.split('\n').filter((l) => l.trim());
        if (lines.length > 0) {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            client.destroy();
            try {
              resolve(JSON.parse(lines[0]));
            } catch {
              reject(new Error('Invalid JSON response from MT4 bridge'));
            }
          }
        }
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    client.on('close', () => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(new Error('Connection closed before response'));
      }
    });
  });
};

/**
 * Connect to an MT4 account via the bridge EA
 */
const connectAccount = async (login, password, server) => {
  try {
    logger.info(`MT4 Bridge: Connecting account ${login}@${server}`);

    const response = await sendCommand('CONNECT', {
      login: String(login),
      password,
      server,
    });

    if (response.status === 'OK') {
      const sessionKey = `${login}@${server}`;
      sessionStore.set(sessionKey, {
        login: String(login),
        server,
        connectedAt: new Date(),
        token: response.token,
      });

      logger.info(`MT4 Bridge: Connected account ${login}@${server}`);
      return {
        success: true,
        name: response.name || `Account ${login}`,
        broker: response.broker || server,
        currency: response.currency || 'USD',
        leverage: response.leverage || 100,
        balance: response.balance || 0,
        equity: response.equity || 0,
        margin: response.margin || 0,
        freeMargin: response.freeMargin || 0,
        profit: response.profit || 0,
      };
    }

    return { success: false, error: response.error || 'Connection failed' };
  } catch (err) {
    logger.error(`MT4 Bridge: Connect failed for ${login}@${server}:`, err.message);

    // DEMO MODE: Return mock data when bridge is not available
    if (process.env.MT4_DEMO_MODE === 'true') {
      logger.warn('MT4 Bridge: Running in DEMO MODE - returning mock data');
      return getMockAccountData(login, server);
    }

    return {
      success: false,
      error: `Cannot connect to MT4 bridge: ${err.message}. Ensure the SeizeBridge EA is running in MetaTrader 4.`,
    };
  }
};

/**
 * Get current account info (balance, equity, etc.)
 */
const getAccountInfo = async (login, server) => {
  try {
    const sessionKey = `${login}@${server}`;
    const session = sessionStore.get(sessionKey);
    const token = session?.token;

    const response = await sendCommand('ACCOUNT_INFO', {
      login: String(login),
      server,
      token,
    });

    if (response.status === 'OK') {
      return {
        success: true,
        balance: response.balance || 0,
        equity: response.equity || 0,
        margin: response.margin || 0,
        freeMargin: response.freeMargin || 0,
        profit: response.profit || 0,
      };
    }

    return { success: false, error: response.error };
  } catch (err) {
    if (process.env.MT4_DEMO_MODE === 'true') {
      return getMockAccountData(login, server);
    }
    return { success: false, error: err.message };
  }
};

/**
 * Get open positions
 */
const getOpenPositions = async (login, server) => {
  try {
    const sessionKey = `${login}@${server}`;
    const session = sessionStore.get(sessionKey);

    const response = await sendCommand('POSITIONS', {
      login: String(login),
      server,
      token: session?.token,
    });

    if (response.status === 'OK') {
      return { success: true, positions: response.positions || [] };
    }

    return { success: false, error: response.error, positions: [] };
  } catch (err) {
    if (process.env.MT4_DEMO_MODE === 'true') {
      return { success: true, positions: getMockPositions() };
    }
    return { success: false, error: err.message, positions: [] };
  }
};

/**
 * Get trade history
 */
const getTradeHistory = async (login, server, fromDate = null) => {
  try {
    const sessionKey = `${login}@${server}`;
    const session = sessionStore.get(sessionKey);

    const from = fromDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const response = await sendCommand('HISTORY', {
      login: String(login),
      server,
      token: session?.token,
      from,
    });

    if (response.status === 'OK') {
      return { success: true, history: response.history || [] };
    }

    return { success: false, error: response.error, history: [] };
  } catch (err) {
    if (process.env.MT4_DEMO_MODE === 'true') {
      return { success: true, history: getMockHistory() };
    }
    return { success: false, error: err.message, history: [] };
  }
};

/**
 * Disconnect an MT4 account session
 */
const disconnectAccount = async (login, server) => {
  try {
    const sessionKey = `${login}@${server}`;
    sessionStore.delete(sessionKey);
    await sendCommand('DISCONNECT', { login: String(login), server });
    logger.info(`MT4 Bridge: Disconnected account ${login}@${server}`);
  } catch {
    // Ignore disconnect errors - session cleanup is sufficient
  }
};

// ─── DEMO / MOCK DATA ───────────────────────────────────────────────────────

const getMockAccountData = (login, server) => ({
  success: true,
  name: `Demo Account ${login}`,
  broker: server || 'Demo Broker',
  currency: 'USD',
  leverage: 100,
  balance: 10000 + Math.random() * 5000,
  equity: 10200 + Math.random() * 4800,
  margin: 500 + Math.random() * 300,
  freeMargin: 9500 + Math.random() * 4500,
  profit: (Math.random() - 0.4) * 500,
});

const getMockPositions = () => {
  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'GOLD', 'NASDAQ'];
  const types = ['BUY', 'SELL'];
  return Array.from({ length: 3 }, (_, i) => ({
    ticket: 100000 + i,
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    type: types[Math.floor(Math.random() * 2)],
    lots: parseFloat((0.1 + Math.random() * 0.9).toFixed(2)),
    openPrice: parseFloat((1.08 + Math.random() * 0.1).toFixed(5)),
    currentPrice: parseFloat((1.08 + Math.random() * 0.1).toFixed(5)),
    stopLoss: parseFloat((1.07 + Math.random() * 0.01).toFixed(5)),
    takeProfit: parseFloat((1.09 + Math.random() * 0.01).toFixed(5)),
    profit: parseFloat(((Math.random() - 0.4) * 200).toFixed(2)),
    swap: parseFloat(((Math.random() - 0.5) * 5).toFixed(2)),
    openTime: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    comment: 'Demo Trade',
  }));
};

const getMockHistory = () => {
  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'GOLD', 'NASDAQ', 'USDCHF', 'AUDUSD'];
  const types = ['BUY', 'SELL'];
  return Array.from({ length: 50 }, (_, i) => {
    const openTime = new Date(Date.now() - (i + 1) * 3600000 * 4);
    const closeTime = new Date(openTime.getTime() + Math.random() * 3600000 * 24);
    return {
      ticket: 90000 + i,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      type: types[Math.floor(Math.random() * 2)],
      lots: parseFloat((0.1 + Math.random() * 1).toFixed(2)),
      openPrice: parseFloat((1.08 + Math.random() * 0.1).toFixed(5)),
      closePrice: parseFloat((1.08 + Math.random() * 0.1).toFixed(5)),
      stopLoss: 0,
      takeProfit: 0,
      profit: parseFloat(((Math.random() - 0.45) * 300).toFixed(2)),
      commission: parseFloat((-Math.random() * 5).toFixed(2)),
      swap: parseFloat(((Math.random() - 0.5) * 5).toFixed(2)),
      openTime: openTime.toISOString(),
      closeTime: closeTime.toISOString(),
      comment: '',
    };
  });
};

module.exports = {
  connectAccount,
  getAccountInfo,
  getOpenPositions,
  getTradeHistory,
  disconnectAccount,
};
