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
    // Admin can fetch token for any account; regular users only for their own
    const query = supabase
      .from('mt4_accounts')
      .select('id')
      .eq('login', String(login))
      .eq('server', server);

    if (req.user.role !== 'admin') {
      query.eq('user_id', req.user.id);
    }

    const { data: account, error } = await query.single();

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
    let { data: account, error: accError } = await supabase
      .from('mt4_accounts')
      .select('id, user_id, is_connected')
      .eq('login', String(login))
      .eq('server', server)
      .maybeSingle();

    // Auto-create account if not in DB yet (fallback: assign to first investor)
    if (!account) {
      const { data: investorUser } = await supabase
        .from('users').select('id').eq('role', 'investor').limit(1).maybeSingle();
      const fallbackUserId = investorUser?.id;
      if (!fallbackUserId) {
        return res.status(404).json({ error: 'No user found to assign account to' });
      }
      const { data: newAcc, error: newErr } = await supabase
        .from('mt4_accounts')
        .insert({
          user_id: fallbackUserId,
          login: String(login),
          server,
          account_name: `Account ${login}`,
          currency: account_info?.currency || 'USD',
          leverage: account_info?.leverage || 100,
          initial_balance: 0,
          balance: 0, equity: 0, margin: 0, free_margin: 0, profit: 0,
          is_connected: false,
        })
        .select('id, user_id, is_connected')
        .single();
      if (newErr) {
        return res.status(500).json({ error: 'Failed to auto-create account' });
      }
      account = newAcc;
      logger.info(`MT4 push: auto-created account login=${login} server=${server}`);
    }

    if (accError && !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const now = new Date().toISOString();

    // Update account balance/equity — also activate if first push
    // NOTE: EA is responsible for dividing cents values (CentsAccount=true in EA input).
    // Backend stores whatever the EA sends — do NOT divide here.
    if (account_info) {
      const updatePayload = {
        balance:     account_info.balance,
        equity:      account_info.equity,
        margin:      account_info.margin,
        free_margin: account_info.freeMargin,
        profit:      account_info.profit,
        is_connected: true,
        last_synced: now,
      };
      if (account_info.broker) updatePayload.broker = account_info.broker;
      if (account_info.currency) updatePayload.currency = account_info.currency;
      if (account_info.leverage) updatePayload.leverage = account_info.leverage;
      if (account_info.name) updatePayload.account_name = account_info.name;

      const { error: updateErr } = await supabase
        .from('mt4_accounts')
        .update(updatePayload)
        .eq('id', account.id);
      if (updateErr) logger.error('mt4Push updateAccount error:', updateErr);

      // Save equity snapshot max 1x per hour
      const { data: lastSnap } = await supabase
        .from('equity_snapshots')
        .select('created_at')
        .eq('mt4_account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const oneHour = 60 * 60 * 1000;
      const lastSnapTime = lastSnap ? new Date(lastSnap.created_at).getTime() : 0;
      if (Date.now() - lastSnapTime >= oneHour) {
        const { error: snapErr } = await supabase.from('equity_snapshots').insert({
          mt4_account_id: account.id,
          user_id: account.user_id,
          balance: account_info.balance,
          equity:  account_info.equity,
          profit:  account_info.profit,
        });
        if (snapErr) logger.error('mt4Push insertSnapshot error:', snapErr);
      }
    }

    // Persist open positions to DB (replace all for this account)
    if (positions && Array.isArray(positions)) {
      // Also update in-memory cache for fast reads
      const cacheKey = `${String(login)}:${server}`;
      positionCache.set(cacheKey, {
        account_id: account.id,
        login: String(login),
        server,
        positions,
        updated_at: now,
      });

      // Delete all existing positions for this account, then insert current ones
      const { error: delErr } = await supabase
        .from('open_positions')
        .delete()
        .eq('mt4_account_id', account.id);
      if (delErr) logger.error('mt4Push deletePositions error:', delErr);

      if (positions.length > 0) {
        const posRows = positions.map((p) => ({
          mt4_account_id: account.id,
          user_id: account.user_id,
          ticket: p.ticket,
          symbol: p.symbol,
          type: p.type,
          lots: p.lots,
          open_price: p.openPrice,
          current_price: p.currentPrice,
          stop_loss: p.stopLoss || 0,
          take_profit: p.takeProfit || 0,
          profit: p.profit,
          swap: p.swap || 0,
          open_time: p.openTime ? new Date(Number(p.openTime) * 1000).toISOString() : null,
          comment: p.comment || '',
          updated_at: now,
        }));
        const { error: insErr } = await supabase.from('open_positions').insert(posRows);
        if (insErr) logger.error('mt4Push insertPositions error:', insErr);
      }
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
          symbol: h.symbol || 'BALANCE',  // BALANCE entries have empty symbol in MT4
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
          .upsert(rows, { onConflict: 'mt4_account_id,ticket', ignoreDuplicates: false });
        if (histErr) logger.error('mt4Push upsertHistory error:', histErr);
      }

      // Auto-detect withdrawals: BALANCE entries with negative profit
      // Use account currency from account_info if available
      const accountCurrency = account_info?.currency || 'USD';

      // Detect type from comment:
      // Internal transfer comments contain "-INT-" (e.g. W-ALLINT-USC-INT-...)
      // Withdrawal comments contain "-USC-" but NOT "-INT-" (e.g. W-BANKIDGT-USC-...)
      const detectType = (comment) => {
        const c = (comment || '').toUpperCase();
        if (c.includes('-INT-')) return 'transfer';
        return 'withdrawal';
      };

      // USC accounts: EA sends raw cents values. Store as cents (same as balance/equity convention).
      // Conversion to USD happens at read time in withdrawalController.
      const withdrawalRows = history
        .filter((h) => h.type === 'BALANCE' && Number(h.profit) < 0)
        .map((h) => ({
          mt4_account_id: account.id,
          user_id: account.user_id,
          ticket: h.ticket,
          amount: Math.abs(Number(h.profit)),
          currency: accountCurrency,
          type: detectType(h.comment),
          comment: h.comment || '',
          close_time: h.closeTime ? new Date(Number(h.closeTime) * 1000).toISOString() : null,
          status: 'detected',
        }));

      if (withdrawalRows.length > 0) {
        // Check which tickets already exist (avoid relying on partial-index conflict target
        // which PostgreSQL won't match via plain ON CONFLICT (col1,col2) without the WHERE predicate)
        const { data: existing } = await supabase
          .from('withdrawals')
          .select('ticket')
          .eq('mt4_account_id', account.id)
          .in('ticket', withdrawalRows.map((r) => r.ticket));

        const existingTickets = new Set((existing || []).map((r) => r.ticket));
        const newRows = withdrawalRows.filter((r) => !existingTickets.has(r.ticket));

        if (newRows.length > 0) {
          const { error: wdErr } = await supabase.from('withdrawals').insert(newRows);
          if (wdErr) logger.error('mt4Push insertWithdrawals error:', wdErr);
          else logger.info(`mt4Push: inserted ${newRows.length} new withdrawal(s) for account ${account.id}`);
        }
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

/**
 * POST /api/mt4/ea-autoregister  (no user JWT — uses EA_SECRET shared key)
 * Called by the EA on first init to auto-fetch its bridge token.
 * Body: { ea_secret, login, server, account_name (optional) }
 * Returns: { bridge_token }
 *
 * EA_SECRET must be set as an environment variable on the server.
 * All EA instances share this one secret — no per-account config needed.
 */
const eaAutoRegister = async (req, res) => {
  const { ea_secret, login, server, account_name } = req.body;

  if (!ea_secret || !login || !server) {
    return res.status(400).json({ error: 'ea_secret, login and server are required' });
  }

  const expectedSecret = process.env.EA_SECRET;
  if (!expectedSecret) {
    return res.status(500).json({ error: 'EA_SECRET not configured on server' });
  }

  // Constant-time compare to prevent timing attacks
  let valid = false;
  try {
    const a = Buffer.from(ea_secret);
    const b = Buffer.from(expectedSecret);
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    return res.status(401).json({ error: 'Invalid EA secret' });
  }

  try {
    // Find an mt4_accounts row for this login+server (any user)
    const { data: account } = await supabase
      .from('mt4_accounts')
      .select('id, user_id')
      .eq('login', String(login))
      .eq('server', server)
      .limit(1)
      .maybeSingle();

    // Auto-create account under an investor if not registered yet
    if (!account) {
      const { data: investorUser } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'investor')
        .limit(1)
        .maybeSingle();

      if (!investorUser) {
        // Fall through — still return token even if we can't auto-create
        logger.warn(`eaAutoRegister: no investor user found to auto-create for login=${login}`);
      } else {
        const { error: createErr } = await supabase
          .from('mt4_accounts')
          .insert({
            user_id: investorUser.id,
            login: String(login),
            server,
            account_name: account_name || `Account ${login}`,
            currency: 'USD',
            leverage: 100,
            initial_balance: 0,
            balance: 0,
            equity: 0,
            margin: 0,
            free_margin: 0,
            profit: 0,
            is_connected: false,
          });

        if (createErr && createErr.code !== '23505') {
          // 23505 = unique violation (account already exists under another user) — ignore
          logger.error('eaAutoRegister auto-create error:', createErr);
        } else {
          logger.info(`EA auto-register: auto-created account login=${login} server=${server}`);
        }
      }
    }

    // Always return token if secret is valid — account existence is not required
    const token = generateBridgeToken(login, server);
    logger.info(`EA auto-register: login=${login} server=${server}`);
    return res.json({ bridge_token: token });
  } catch (err) {
    logger.error('eaAutoRegister error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getBridgeToken, receiveMT4Push, eaAutoRegister, positionCache, generateBridgeToken };
