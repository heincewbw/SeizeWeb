const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/stats/summary
const getSummary = async (req, res) => {
  const { account_id } = req.query;

  try {
    let accountQuery = supabase
      .from('mt4_accounts')
      .select('balance, equity, profit, free_margin, margin')
      .eq('user_id', req.user.id)
      .eq('is_connected', true);

    if (account_id) accountQuery = accountQuery.eq('id', account_id);

    const { data: accounts, error: accError } = await accountQuery;
    if (accError) throw accError;

    const totalBalance = (accounts || []).reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalEquity = (accounts || []).reduce((sum, a) => sum + (a.equity || 0), 0);
    const totalProfit = (accounts || []).reduce((sum, a) => sum + (a.profit || 0), 0);
    const totalFreeMargin = (accounts || []).reduce((sum, a) => sum + (a.free_margin || 0), 0);

    // Trade stats from history
    let histQuery = supabase
      .from('trade_history')
      .select('profit, symbol, lots')
      .eq('user_id', req.user.id);

    if (account_id) histQuery = histQuery.eq('mt4_account_id', account_id);

    const { data: trades } = await histQuery;

    const totalTrades = (trades || []).length;
    const winningTrades = (trades || []).filter((t) => (t.profit || 0) > 0).length;
    const losingTrades = (trades || []).filter((t) => (t.profit || 0) < 0).length;
    const totalPnl = (trades || []).reduce((sum, t) => sum + (t.profit || 0), 0);
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(2) : 0;

    const grossProfit = (trades || [])
      .filter((t) => t.profit > 0)
      .reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(
      (trades || []).filter((t) => t.profit < 0).reduce((sum, t) => sum + t.profit, 0)
    );
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
      .select('equity, balance, profit, created_at')
      .eq('user_id', req.user.id)
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: true });

    if (account_id) query = query.eq('mt4_account_id', account_id);

    const { data: snapshots, error } = await query;
    if (error) throw error;

    return res.json({ chart: snapshots || [] });
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

module.exports = { getSummary, getEquityChart, getSymbolBreakdown };
