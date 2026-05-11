const supabase = require('../config/supabase');
const logger = require('../config/logger');
const { positionCache } = require('./mt4PushController');

// GET /api/positions
const getOpenPositions = async (req, res) => {
  const { account_id } = req.query;

  try {
    // Get user's connected accounts
    let accountQuery = supabase
      .from('mt4_accounts')
      .select('id, login, server, currency')
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

    const accountIds = accounts.map((a) => a.id);

    // Cache-first: EA sends pre-aggregated positions to cache on every push.
    // Prefer cache over DB because cache always has the current aggregated format.
    // DB fallback handles the case where the server just restarted and cache is empty.
    const allPositions = [];
    let cacheHit = false;
    for (const account of accounts) {
      const cacheKey = `${account.login}:${account.server}`;
      const cached = positionCache.get(cacheKey);
      if (cached) {
        cacheHit = true;
        const divisor = account.currency === 'USC' ? 100 : 1;
        allPositions.push(...cached.positions.map((p) => ({
          ...p,
          profit: (Number(p.profit) || 0) / divisor,
          swap:   (Number(p.swap)   || 0) / divisor,
          account_id: account.id,
          login: account.login,
          server: account.server,
        })));
      }
    }
    if (cacheHit) return res.json({ positions: allPositions });

    // DB fallback (server just restarted — stale per-ticket rows until next EA push)
    let { data: dbPositions, error: posErr } = await supabase
      .from('open_positions')
      .select('*')
      .in('mt4_account_id', accountIds)
      .order('open_time', { ascending: false });

    if (posErr) throw posErr;

    if (dbPositions && dbPositions.length > 0) {
      const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));
      const positions = dbPositions.map((p) => {
        const acc = accountMap[p.mt4_account_id];
        const divisor = acc?.currency === 'USC' ? 100 : 1;
        return {
          ticket: p.ticket,
          symbol: p.symbol,
          type: p.type,
          lots: p.lots,
          openPrice: p.open_price,
          currentPrice: p.current_price,
          stopLoss: p.stop_loss,
          takeProfit: p.take_profit,
          profit: (Number(p.profit) || 0) / divisor,
          swap: (Number(p.swap) || 0) / divisor,
          openTime: p.open_time ? Math.floor(new Date(p.open_time).getTime() / 1000) : null,
          comment: p.comment,
          account_id: p.mt4_account_id,
          login: acc?.login,
          server: acc?.server,
        };
      });
      return res.json({ positions });
    }
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
      .select('*, mt4_accounts(currency)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .not('type', 'in', '("BALANCE","CREDIT")')
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

    // Normalize USC values: trade_history stores raw cents for USC accounts
    const normalizedTrades = (trades || []).map((t) => {
      const divisor = t.mt4_accounts?.currency === 'USC' ? 100 : 1;
      if (divisor === 1) return t;
      return {
        ...t,
        profit:     (Number(t.profit)     || 0) / divisor,
        commission: (Number(t.commission) || 0) / divisor,
        swap:       (Number(t.swap)       || 0) / divisor,
      };
    });

    return res.json({
      trades: normalizedTrades,
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

// GET /api/positions/history/daily
// Returns trade history pre-aggregated by day — avoids sending thousands of raw rows
// to the frontend just to be grouped there. Frontend gets ~30-365 rows instead of up to 5000.
const getTradeHistoryDaily = async (req, res) => {
  const { account_id, from_date, to_date } = req.query;

  try {
    // Select only the columns needed for aggregation — much smaller payload than '*'
    let query = supabase
      .from('trade_history')
      .select('profit, commission, swap, lots, close_time, mt4_accounts(currency)')
      .eq('user_id', req.user.id)
      .not('type', 'in', '("BALANCE","CREDIT")')
      .order('close_time', { ascending: true });

    if (account_id) query = query.eq('mt4_account_id', account_id);
    if (from_date)  query = query.gte('close_time', from_date);
    if (to_date)    query = query.lte('close_time', to_date);

    const { data: trades, error } = await query;
    if (error) throw error;

    // Aggregate by date in Node — single pass, no client-side processing needed
    const map = new Map();
    for (const t of (trades || [])) {
      const date = t.close_time ? t.close_time.slice(0, 10) : null;
      if (!date) continue;
      const divisor = t.mt4_accounts?.currency === 'USC' ? 100 : 1;
      const profit     = (Number(t.profit)     || 0) / divisor;
      const commission = (Number(t.commission) || 0) / divisor;
      const swap       = (Number(t.swap)       || 0) / divisor;
      const net        = profit + commission + swap;
      const lots       = Number(t.lots) || 0;

      const row = map.get(date) || { date, trades: 0, wins: 0, losses: 0, lots: 0, profit: 0, net: 0 };
      row.trades++;
      if (net > 0) row.wins++;
      else if (net < 0) row.losses++;
      row.lots   += lots;
      row.profit += profit;
      row.net    += net;
      map.set(date, row);
    }

    // Newest day first (matches original History.jsx display order)
    const daily = Array.from(map.values()).sort((a, b) => (a.date > b.date ? -1 : 1));
    return res.json({ daily });
  } catch (err) {
    logger.error('GetTradeHistoryDaily exception:', err);
    return res.status(500).json({ error: 'Failed to fetch daily history' });
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

    // Trade history is pushed by EA — read from DB
    const { data: trades, error: tradeErr } = await supabase
      .from('trade_history')
      .select('*')
      .eq('mt4_account_id', accountId)
      .order('close_time', { ascending: false });

    if (tradeErr) throw tradeErr;

    return res.json({ message: 'Trade history synced', count: trades?.length || 0 });
  } catch (err) {
    logger.error('SyncTradeHistory exception:', err);
    return res.status(500).json({ error: 'Failed to sync trade history' });
  }
};

module.exports = { getOpenPositions, getTradeHistory, getTradeHistoryDaily, syncTradeHistory };
