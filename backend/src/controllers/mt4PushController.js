const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../config/logger');

// In-memory cache for open positions (keyed by "login:server")
const positionCache = new Map();

/**
 * Generate a deterministic bridge token from login + server.
 * No DB storage needed — token is re-derived on every request.
 */
const generateBridgeToken = (login, server) => {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${String(login).trim()}:${String(server).trim()}`)
    .digest('hex');
};

/**
 * GET /api/mt4/token?login=xxx&server=xxx
 * Returns the bridge token for an account the authenticated user owns.
 */
const getBridgeToken = async (req, res) => {
  const { login, server } = req.query;
  if (!login || !server) {
    return res.status(400).json({ error: 'login and server are required' });
  }

  try {
    // Verify the account belongs to this user
    const { data: account, error } = await supabase
      .from('mt4_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('login', String(login))
      .eq('server', server)
      .single();

    if (error || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const token = generateBridgeToken(login, server);
    return res.json({ bridge_token: token });
  } catch (err) {
    logger.error('GetBridgeToken error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/mt4/push  (no auth — uses bridge token instead of JWT)
 * Receives pushed data from MT4 EA.
 * Body: { token, login, server, account_info: {...}, positions: [...], history: [...] }
 */
const receiveMT4Push = async (req, res) => {
  const { token, login, server, account_info, positions, history } = req.body;

  if (!token || !login || !server) {
    return res.status(400).json({ error: 'token, login, and server are required' });
  }

  // Verify bridge token (constant-time compare)
  const expected = generateBridgeToken(login, server);
  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(token.toLowerCase(), 'hex'),
      Buffer.from(expected.toLowerCase(), 'hex')
    );
  } catch {
    return res.status(401).json({ error: 'Invalid token format' });
  }
  if (!valid) {
    return res.status(401).json({ error: 'Invalid bridge token' });
  }

  try {
    // Find account
    const { data: account, error: accError } = await supabase
      .from('mt4_accounts')
      .select('id, user_id')
      .eq('login', String(login))
      .eq('server', server)
      .eq('is_connected', true)
      .single();

    if (accError || !account) {
      return res.status(404).json({ error: 'Connected account not found' });
    }

    const now = new Date().toISOString();

    // Update account balance/equity
    if (account_info) {
      await supabase
        .from('mt4_accounts')
        .update({
          balance: account_info.balance,
          equity: account_info.equity,
          margin: account_info.margin,
          free_margin: account_info.freeMargin,
          profit: account_info.profit,
          last_synced: now,
        })
        .eq('id', account.id);

      // Save equity snapshot (roughly once per push)
      await supabase.from('equity_snapshots').insert({
        mt4_account_id: account.id,
        user_id: account.user_id,
        balance: account_info.balance,
        equity: account_info.equity,
        profit: account_info.profit,
      });
    }

    // Cache open positions in memory
    if (positions && Array.isArray(positions)) {
      const cacheKey = `${String(login)}:${server}`;
      positionCache.set(cacheKey, {
        account_id: account.id,
        login: String(login),
        server,
        positions,
        updated_at: now,
      });
    }

    // Save trade history (upsert)
    if (history && Array.isArray(history) && history.length > 0) {
      const rows = history.map((h) => ({
        mt4_account_id: account.id,
        user_id: account.user_id,
        ticket: h.ticket,
        symbol: h.symbol,
        type: h.type,
        lots: h.lots,
        open_price: h.openPrice,
        close_price: h.closePrice,
        stop_loss: h.stopLoss || 0,
        take_profit: h.takeProfit || 0,
        profit: h.profit,
        commission: h.commission || 0,
        swap: h.swap || 0,
        open_time: h.openTime
          ? new Date(typeof h.openTime === 'number' ? h.openTime * 1000 : h.openTime).toISOString()
          : null,
        close_time: h.closeTime
          ? new Date(typeof h.closeTime === 'number' ? h.closeTime * 1000 : h.closeTime).toISOString()
          : null,
        comment: h.comment || '',
      }));

      await supabase
        .from('trade_history')
        .upsert(rows, { onConflict: 'mt4_account_id,ticket' });
    }

    logger.info(
      `MT4 push received: login=${login} server=${server} ` +
      `positions=${positions?.length ?? 0} history=${history?.length ?? 0}`
    );

    return res.json({ success: true, message: 'Data received' });
  } catch (err) {
    logger.error('MT4 push error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getBridgeToken, receiveMT4Push, positionCache, generateBridgeToken };
