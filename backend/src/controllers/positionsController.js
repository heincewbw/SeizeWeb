const supabase = require('../config/supabase');
const logger = require('../config/logger');
const mt4Bridge = require('../services/mt4Bridge');
const { positionCache } = require('./mt4PushController');

// GET /api/positions
const getOpenPositions = async (req, res) => {
  const { account_id } = req.query;

  try {
    // Get user's accounts
    let accountQuery = supabase
      .from('mt4_accounts')
      .select('id, login, server')
      .eq('user_id', req.user.id)
      .eq('is_connected', true);

    if (account_id) {
      accountQuery = accountQuery.eq('id', account_id);
    }

    const { data: accounts, error: accError } = await accountQuery;
    if (accError) throw accError;

    if (!accounts || accounts.length === 0) {
      return res.json({ positions: [] });
    }

    // Fetch positions: use push cache if available, else fall back to mt4Bridge (mock)
    const allPositions = [];
    for (const account of accounts) {
      const cacheKey = `${account.login}:${account.server}`;
      const cached = positionCache.get(cacheKey);

      if (cached) {
        const positionsWithAccount = cached.positions.map((p) => ({
          ...p,
          account_id: account.id,
          login: account.login,
          server: account.server,
        }));
        allPositions.push(...positionsWithAccount);
      } else {
        // Fallback to mt4Bridge (demo mock when MT4_DEMO_MODE=true)
        const result = await mt4Bridge.getOpenPositions(account.login, account.server);
        if (result.success && result.positions) {
          const positionsWithAccount = result.positions.map((p) => ({
            ...p,
            account_id: account.id,
            login: account.login,
            server: account.server,
          }));
          allPositions.push(...positionsWithAccount);
        }
      }
    }

    return res.json({ positions: allPositions });
  } catch (err) {
    logger.error('GetOpenPositions exception:', err);
    return res.status(500).json({ error: 'Failed to fetch positions' });
  }
};

// GET /api/positions/history
const getTradeHistory = async (req, res) => {
  const { account_id, from_date, to_date, page = 1, limit = 50 } = req.query;

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('trade_history')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('close_time', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (account_id) {
      query = query.eq('mt4_account_id', account_id);
    }
    if (from_date) {
      query = query.gte('close_time', from_date);
    }
    if (to_date) {
      query = query.lte('close_time', to_date);
    }

    const { data: trades, error, count } = await query;

    if (error) throw error;

    return res.json({
      trades: trades || [],
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error('GetTradeHistory exception:', err);
    return res.status(500).json({ error: 'Failed to fetch trade history' });
  }
};

// POST /api/positions/sync-history/:accountId
const syncTradeHistory = async (req, res) => {
  const { accountId } = req.params;

  try {
    const { data: account, error: fetchError } = await supabase
      .from('mt4_accounts')
      .select('id, login, server')
      .eq('id', accountId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const result = await mt4Bridge.getTradeHistory(account.login, account.server);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to fetch history' });
    }

    if (result.history && result.history.length > 0) {
      const records = result.history.map((trade) => ({
        mt4_account_id: account.id,
        user_id: req.user.id,
        ticket: trade.ticket,
        symbol: trade.symbol,
        type: trade.type,
        lots: trade.lots,
        open_price: trade.openPrice,
        close_price: trade.closePrice,
        stop_loss: trade.stopLoss,
        take_profit: trade.takeProfit,
        profit: trade.profit,
        commission: trade.commission,
        swap: trade.swap,
        open_time: trade.openTime,
        close_time: trade.closeTime,
        comment: trade.comment,
      }));

      // Upsert to avoid duplicates
      await supabase
        .from('trade_history')
        .upsert(records, { onConflict: 'mt4_account_id,ticket', ignoreDuplicates: true });
    }

    logger.info(`Synced ${result.history?.length || 0} trades for account ${accountId}`);
    return res.json({ message: 'Trade history synced', count: result.history?.length || 0 });
  } catch (err) {
    logger.error('SyncTradeHistory exception:', err);
    return res.status(500).json({ error: 'Failed to sync trade history' });
  }
};

module.exports = { getOpenPositions, getTradeHistory, syncTradeHistory };
