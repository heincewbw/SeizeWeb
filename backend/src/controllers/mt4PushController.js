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
    // Find account (connected OR not — EA push activates it)
    const { data: account, error: accError } = await supabase
      .from('mt4_accounts')
      .select('id, user_id, is_connected')
      .eq('login', String(login))
      .eq('server', server)
      .single();

    if (accError || !account) {
      return res.status(404).json({ error: 'Connected account not found' });
    }

    const now = new Date().toISOString();

    // Update account balance/equity — also activate if first push
    if (account_info) {
      const updatePayload = {
        balance: account_info.balance,
        equity: account_info.equity,
        margin: account_info.margin,
        free_margin: account_info.freeMargin,
        profit: account_info.profit,
        is_connected: true,
        last_synced: now,
      };
      if (account_info.broker) updatePayload.broker = account_info.broker;
      if (account_info.currency) updatePayload.currency = account_info.currency;
      if (account_info.leverage) updatePayload.leverage = account_info.leverage;
      if (!account.is_connected && account_info.name) updatePayload.account_name = account_info.name;

      const { error: updateErr } = await supabase
        .from('mt4_accounts')
        .update(updatePayload)
        .eq('id', account.id);
      if (updateErr) logger.error('mt4Push updateAccount error:', updateErr);

      // Save equity snapshot
      const { error: snapErr } = await supabase.from('equity_snapshots').insert({
        mt4_account_id: account.id,
        user_id: account.user_id,
        balance: account_info.balance,
        equity: account_info.equity,
        profit: account_info.profit,
      });
      if (snapErr) logger.error('mt4Push insertSnapshot error:', snapErr);
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
      const ALLOWED_TYPES = ['BUY', 'SELL', 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP', 'BALANCE', 'CREDIT'];
      const rows = history
        .filter((h) => ALLOWED_TYPES.includes(h.type)) // skip UNKNOWN etc
        .map((h) => ({
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
            ? new Date(Number(h.openTime) * 1000).toISOString()
            : null,
          close_time: h.closeTime
            ? new Date(Number(h.closeTime) * 1000).toISOString()
            : null,
          comment: h.comment || '',
        }));

      if (rows.length > 0) {
        const { error: histErr } = await supabase
          .from('trade_history')
          .upsert(rows, { onConflict: 'mt4_account_id,ticket', ignoreDuplicates: true });
        if (histErr) logger.error('mt4Push upsertHistory error:', histErr);
      }
    }

    logger.info(
      `MT4 push received: login=${login} server=${server} ` +
      `positions=${positions?.length ?? 0} history=${history?.length ?? 0}`
    );

    return res.json({ success: true, message: 'Data received' });
  } catch (err) {
    logger.error('MT4 push error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

module.exports = { getBridgeToken, receiveMT4Push, positionCache, generateBridgeToken };
