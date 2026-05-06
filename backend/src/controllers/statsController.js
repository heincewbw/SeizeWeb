const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/stats/summary
const getSummary = async (req, res) => {
  const { account_id } = req.query;

  try {
    let accountQuery = supabase
      .from('mt4_accounts')
      .select('balance, equity, profit, free_margin, margin, currency')
      .eq('user_id', req.user.id)
      .eq('is_connected', true);

    if (account_id) accountQuery = accountQuery.eq('id', account_id);

    const { data: accounts, error: accError } = await accountQuery;
    if (accError) throw accError;

    // USC accounts: divide by 100 to normalize to USD
    const normalize = (a, field) => ((Number(a[field]) || 0) / (a.currency === 'USC' ? 100 : 1));

    const totalBalance    = (accounts || []).reduce((sum, a) => sum + normalize(a, 'balance'), 0);
    const totalEquity     = (accounts || []).reduce((sum, a) => sum + normalize(a, 'equity'), 0);
    const totalProfit     = (accounts || []).reduce((sum, a) => sum + normalize(a, 'profit'), 0);
    const totalFreeMargin = (accounts || []).reduce((sum, a) => sum + normalize(a, 'free_margin'), 0);

    // Trade stats from history — join mt4_accounts to get currency for USC normalization
    let histQuery = supabase
      .from('trade_history')
      .select('profit, symbol, lots, mt4_accounts(currency)')
      .eq('user_id', req.user.id);

    if (account_id) histQuery = histQuery.eq('mt4_account_id', account_id);

    const { data: rawTrades } = await histQuery;

    // Normalize USC profits: trade_history stores raw cents for USC accounts
    const trades = (rawTrades || []).map((t) => {
      const divisor = t.mt4_accounts?.currency === 'USC' ? 100 : 1;
      return { ...t, profit: (Number(t.profit) || 0) / divisor };
    });

    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.profit > 0).length;
    const losingTrades = trades.filter((t) => t.profit < 0).length;
    const totalPnl = trades.reduce((sum, t) => sum + t.profit, 0);
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(2) : 0;

    const grossProfit = trades.filter((t) => t.profit > 0).reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(trades.filter((t) => t.profit < 0).reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : 0;

    return res.json({
      summary: {
        totalBalance,
        totalEquity,
        totalProfit,
        totalFreeMargin,
        totalAccounts: accounts?.length || 0,
      },
      tradeStats: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: parseFloat(winRate),
        totalPnl,
        profitFactor: parseFloat(profitFactor) || profitFactor,
        grossProfit,
        grossLoss,
      },
    });
  } catch (err) {
    logger.error('GetSummary exception:', err);
    return res.status(500).json({ error: 'Failed to fetch summary' });
  }
};

// GET /api/stats/equity-chart
const getEquityChart = async (req, res) => {
  const { account_id, period = '30d' } = req.query;

  const periodDays = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '180d': 180,
    '365d': 365,
  };

  const days = periodDays[period] || 30;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  try {
    let query = supabase
      .from('equity_snapshots')
      .select('equity, balance, profit, created_at, mt4_account_id, mt4_accounts(currency)')
      .eq('user_id', req.user.id)
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: true });

    if (account_id) query = query.eq('mt4_account_id', account_id);

    const { data: snapshots, error } = await query;
    if (error) throw error;

    if (!snapshots || snapshots.length === 0) {
      return res.json({ chart: [] });
    }

    // Normalize USC values in snapshots
    const normSnap = (snap) => {
      const divisor = snap.mt4_accounts?.currency === 'USC' ? 100 : 1;
      return {
        ...snap,
        equity:  (snap.equity  || 0) / divisor,
        balance: (snap.balance || 0) / divisor,
        profit:  (snap.profit  || 0) / divisor,
      };
    };

    // If single account selected, return normalized snapshots
    if (account_id) {
      return res.json({ chart: snapshots.map(normSnap) });
    }

    // Multi-account: aggregate by hour bucket, sum equity+balance across accounts
    // Use the latest snapshot per account per bucket
    const buckets = {}; // key: "YYYY-MM-DDTHH" → { [account_id]: normalized snap }
    for (const snap of snapshots) {
      const normalized = normSnap(snap);
      const dt = new Date(snap.created_at);
      // Truncate to hour
      const bucketKey = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}`;
      if (!buckets[bucketKey]) buckets[bucketKey] = {};
      // Keep latest per account within the bucket
      buckets[bucketKey][snap.mt4_account_id] = normalized;
    }

    // Build aggregated chart: sum all accounts in each bucket
    const chart = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketKey, accountSnaps]) => {
        const values = Object.values(accountSnaps);
        return {
          created_at: values[0].created_at,
          equity:  values.reduce((s, v) => s + (v.equity  || 0), 0),
          balance: values.reduce((s, v) => s + (v.balance || 0), 0),
          profit:  values.reduce((s, v) => s + (v.profit  || 0), 0),
        };
      });

    return res.json({ chart });
  } catch (err) {
    logger.error('GetEquityChart exception:', err);
    return res.status(500).json({ error: 'Failed to fetch equity chart' });
  }
};

// GET /api/stats/symbol-breakdown
const getSymbolBreakdown = async (req, res) => {
  const { account_id } = req.query;

  try {
    let query = supabase
      .from('trade_history')
      .select('symbol, profit, lots')
      .eq('user_id', req.user.id);

    if (account_id) query = query.eq('mt4_account_id', account_id);

    const { data: trades, error } = await query;
    if (error) throw error;

    const breakdown = {};
    (trades || []).forEach((trade) => {
      if (!breakdown[trade.symbol]) {
        breakdown[trade.symbol] = { symbol: trade.symbol, count: 0, profit: 0, lots: 0 };
      }
      breakdown[trade.symbol].count++;
      breakdown[trade.symbol].profit += trade.profit || 0;
      breakdown[trade.symbol].lots += trade.lots || 0;
    });

    const result = Object.values(breakdown)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.json({ breakdown: result });
  } catch (err) {
    logger.error('GetSymbolBreakdown exception:', err);
    return res.status(500).json({ error: 'Failed to fetch symbol breakdown' });
  }
};

// GET /api/stats/monthly-gain
const getMonthlyGain = async (req, res) => {
  const { account_id } = req.query;

  try {
    let query = supabase
      .from('equity_snapshots')
      .select('balance, equity, created_at, mt4_account_id, mt4_accounts(currency)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });

    if (account_id) query = query.eq('mt4_account_id', account_id);

    const { data: snapshots, error } = await query;
    if (error) throw error;

    if (!snapshots || snapshots.length === 0) {
      return res.json({ monthly: [] });
    }

    // Normalize USC values
    const normSnap = (snap) => {
      const divisor = snap.mt4_accounts?.currency === 'USC' ? 100 : 1;
      return {
        created_at: snap.created_at,
        balance: (snap.balance || 0) / divisor,
        equity: (snap.equity || 0) / divisor,
        mt4_account_id: snap.mt4_account_id,
      };
    };

    const normalized = snapshots.map(normSnap);

    // Group by year-month
    const monthMap = {};
    for (const snap of normalized) {
      const d = new Date(snap.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = [];
      monthMap[key].push(snap);
    }

    const monthly = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, snaps]) => {
        const first = snaps[0].balance;
        const last = snaps[snaps.length - 1].balance;
        const gainPct = first > 0 ? ((last - first) / first) * 100 : 0;
        const [year, month] = key.split('-');
        return {
          key,
          year: parseInt(year),
          month: parseInt(month),
          gainPct: parseFloat(gainPct.toFixed(2)),
          startBalance: parseFloat(first.toFixed(2)),
          endBalance: parseFloat(last.toFixed(2)),
        };
      });

    return res.json({ monthly });
  } catch (err) {
    logger.error('GetMonthlyGain exception:', err);
    return res.status(500).json({ error: 'Failed to fetch monthly gain' });
  }
};

// GET /api/stats/portfolio-share
// Returns current user's total balance vs all users' combined balance
const getPortfolioShare = async (req, res) => {
  try {
    const normalize = (a) => ((Number(a.balance) || 0) / (a.currency === 'USC' ? 100 : 1));

    const [userRes, allRes] = await Promise.all([
      supabase
        .from('mt4_accounts')
        .select('balance, currency')
        .eq('user_id', req.user.id)
        .eq('is_connected', true),
      supabase
        .from('mt4_accounts')
        .select('balance, currency, user_id')
        .eq('is_connected', true),
    ]);

    if (userRes.error) throw userRes.error;
    if (allRes.error) throw allRes.error;

    const userBalance = (userRes.data || []).reduce((sum, a) => sum + normalize(a), 0);
    const totalBalance = (allRes.data || []).reduce((sum, a) => sum + normalize(a), 0);
    const otherBalance = totalBalance - userBalance;

    const percentage = totalBalance > 0 ? parseFloat(((userBalance / totalBalance) * 100).toFixed(2)) : 0;

    // Count distinct users
    const uniqueUsers = new Set((allRes.data || []).map((a) => a.user_id)).size;

    return res.json({ userBalance, otherBalance, totalBalance, percentage, totalUsers: uniqueUsers });
  } catch (err) {
    logger.error('GetPortfolioShare exception:', err);
    return res.status(500).json({ error: 'Failed to fetch portfolio share' });
  }
};

module.exports = { getSummary, getEquityChart, getSymbolBreakdown, getMonthlyGain, getPortfolioShare };
