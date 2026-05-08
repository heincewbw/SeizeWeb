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
      .eq('user_id', req.user.id)
      .not('type', 'in', '("BALANCE","CREDIT")');

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

    // Build aggregated chart: carry-forward last known value per account so
    // buckets where only some accounts reported don't cause false spikes.
    const sortedBuckets = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
    const lastKnown = {}; // { [account_id]: { equity, balance, profit } }

    const chart = sortedBuckets.map(([, accountSnaps]) => {
      // Update lastKnown with any new snapshots in this bucket
      for (const [accountId, snap] of Object.entries(accountSnaps)) {
        lastKnown[accountId] = snap;
      }
      // Sum ALL accounts seen so far (carry-forward fills gaps)
      let equity = 0, balance = 0, profit = 0;
      for (const snap of Object.values(lastKnown)) {
        equity  += snap.equity  || 0;
        balance += snap.balance || 0;
        profit  += snap.profit  || 0;
      }
      return {
        created_at: Object.values(accountSnaps)[0].created_at,
        equity, balance, profit,
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
// Monthly gain = (endBalance + withdrawalsInMonth - startBalance) / initialBalance * 100
// where startBalance = end of previous month (or initial_balance if first month)
const getMonthlyGain = async (req, res) => {
  const { account_id } = req.query;

  try {
    // 1. Fetch accounts (need initial_balance + currency)
    let accountsQuery = supabase
      .from('mt4_accounts')
      .select('id, initial_balance, currency')
      .eq('user_id', req.user.id);
    if (account_id) accountsQuery = accountsQuery.eq('id', account_id);

    const { data: accounts, error: accErr } = await accountsQuery;
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) return res.json({ monthly: [] });

    const accountIds = accounts.map((a) => a.id);
    const accMap = Object.fromEntries(accounts.map((a) => [a.id, a]));
    const div = (id) => (accMap[id]?.currency === 'USC' ? 100 : 1);

    // Total initial balance (sum across selected accounts, normalized)
    const totalInitial = accounts.reduce(
      (sum, a) => sum + (Number(a.initial_balance) || 0) / (a.currency === 'USC' ? 100 : 1),
      0
    );

    // 2. Fetch snapshots
    let snapQuery = supabase
      .from('equity_snapshots')
      .select('balance, created_at, mt4_account_id')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });
    if (account_id) snapQuery = snapQuery.eq('mt4_account_id', account_id);

    const { data: snapshots, error: snapErr } = await snapQuery;
    if (snapErr) throw snapErr;

    // 3. Fetch withdrawals (verified/detected count as real outflow)
    let wdQuery = supabase
      .from('withdrawals')
      .select('amount, currency, close_time, mt4_account_id, status')
      .eq('user_id', req.user.id)
      .in('status', ['detected', 'verified']);
    if (account_id) wdQuery = wdQuery.eq('mt4_account_id', account_id);

    const { data: withdrawals, error: wdErr } = await wdQuery;
    if (wdErr) throw wdErr;

    const monthKey = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // 4. For each account, find last snapshot per month
    // Map: accountId -> { 'YYYY-MM' -> lastBalanceNormalized }
    const perAccMonthEnd = {};
    for (const id of accountIds) perAccMonthEnd[id] = {};
    for (const snap of snapshots || []) {
      const id = snap.mt4_account_id;
      if (!perAccMonthEnd[id]) continue;
      const key = monthKey(new Date(snap.created_at));
      const balNorm = (Number(snap.balance) || 0) / div(id);
      // snapshots are sorted ascending → last write wins
      perAccMonthEnd[id][key] = balNorm;
    }

    // 5. Withdrawals per month (summed across accounts, normalized)
    const wdPerMonth = {};
    for (const w of withdrawals || []) {
      const t = w.close_time || w.created_at;
      if (!t) continue;
      const key = monthKey(new Date(t));
      const amtNorm = (Number(w.amount) || 0) / (w.currency === 'USC' ? 100 : 1);
      wdPerMonth[key] = (wdPerMonth[key] || 0) + amtNorm;
    }

    // 6. Build sorted list of months that have snapshot data
    const monthSet = new Set();
    for (const id of accountIds) Object.keys(perAccMonthEnd[id]).forEach((k) => monthSet.add(k));
    Object.keys(wdPerMonth).forEach((k) => monthSet.add(k));
    const months = [...monthSet].sort();

    if (months.length === 0 || totalInitial <= 0) {
      return res.json({ monthly: [] });
    }

    // 7. For each month compute total end balance = sum(last snap per acc up to that month)
    // If account has no snap in month M, carry-forward last known balance (or 0).
    const monthly = [];
    const lastKnown = {}; // accountId -> last balance seen
    for (const id of accountIds) lastKnown[id] = 0;

    let prevTotalEnd = totalInitial; // start of first month = initial balance

    for (const key of months) {
      let totalEnd = 0;
      for (const id of accountIds) {
        if (perAccMonthEnd[id][key] !== undefined) {
          lastKnown[id] = perAccMonthEnd[id][key];
        }
        totalEnd += lastKnown[id];
      }
      const wd = wdPerMonth[key] || 0;
      const profit = totalEnd + wd - prevTotalEnd;
      const gainPct = totalInitial > 0 ? (profit / totalInitial) * 100 : 0;

      const [year, month] = key.split('-');
      monthly.push({
        key,
        year: parseInt(year),
        month: parseInt(month),
        gainPct: parseFloat(gainPct.toFixed(2)),
        startBalance: parseFloat(prevTotalEnd.toFixed(2)),
        endBalance: parseFloat(totalEnd.toFixed(2)),
        withdrawals: parseFloat(wd.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
      });

      prevTotalEnd = totalEnd;
    }

    return res.json({ monthly, initialBalance: parseFloat(totalInitial.toFixed(2)) });
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

// GET /api/stats/statement?month=&year=&account_id=
// Returns CSV of all closed trades for the given month
const getMonthlyStatement = async (req, res) => {
  const { month, year, account_id } = req.query;

  const m = parseInt(month);
  const y = parseInt(year);
  if (!m || !y || m < 1 || m > 12 || y < 2000) {
    return res.status(400).json({ error: 'Valid month (1–12) and year are required' });
  }

  const startDate = new Date(y, m - 1, 1).toISOString();
  const endDate   = new Date(y, m, 0, 23, 59, 59).toISOString();

  try {
    let query = supabase
      .from('trade_history')
      .select(
        `ticket, symbol, type, lots, open_price, close_price,
         profit, commission, swap, open_time, close_time, comment,
         mt4_accounts(account_name, login, currency)`
      )
      .eq('user_id', req.user.id)
      .not('type', 'in', '("BALANCE","CREDIT")')
      .gte('close_time', startDate)
      .lte('close_time', endDate)
      .order('close_time', { ascending: true });

    if (account_id) query = query.eq('mt4_account_id', account_id);

    const { data: trades, error } = await query;
    if (error) throw error;

    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const headers = ['Ticket','Account','Symbol','Type','Lots','Open Price','Close Price','Profit','Commission','Swap','Net P&L','Open Time','Close Time','Comment'];
    const rows = (trades || []).map((t) => {
      const div = t.mt4_accounts?.currency === 'USC' ? 100 : 1;
      const profit     = (Number(t.profit) || 0) / div;
      const commission = (Number(t.commission) || 0) / div;
      const swap       = (Number(t.swap) || 0) / div;
      return [
        t.ticket,
        `"${t.mt4_accounts?.account_name || ''}"`,
        t.symbol,
        t.type,
        t.lots,
        t.open_price,
        t.close_price,
        profit.toFixed(2),
        commission.toFixed(2),
        swap.toFixed(2),
        (profit + commission + swap).toFixed(2),
        t.open_time  ? new Date(t.open_time).toISOString()  : '',
        t.close_time ? new Date(t.close_time).toISOString() : '',
        `"${(t.comment || '').replace(/"/g, "'")}"`,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `statement_${MONTH_NAMES[m - 1]}_${y}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    logger.error('getMonthlyStatement error:', err);
    return res.status(500).json({ error: 'Failed to generate statement' });
  }
};

module.exports = { getSummary, getEquityChart, getSymbolBreakdown, getMonthlyGain, getPortfolioShare, getMonthlyStatement };
