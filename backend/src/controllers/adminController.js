const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/admin/users-overview
// Returns all users with their MT4 accounts and calculated stats
const getUsersOverview = async (req, res) => {
  try {
    // Fetch all users
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_active, created_at')
      .order('full_name', { ascending: true });

    if (usersErr) throw usersErr;

    // Fetch all MT4 accounts with their data
    const { data: accounts, error: accErr } = await supabase
      .from('mt4_accounts')
      .select(
        'id, user_id, login, server, account_name, currency, initial_balance, balance, equity, profit, is_connected, last_synced'
      )
      .eq('is_connected', true)
      .order('created_at', { ascending: true });

    if (accErr) throw accErr;

    // Fetch min equity per account from equity_snapshots (for Max DD calculation)
    const { data: minEquities, error: snapErr } = await supabase
      .from('equity_snapshots')
      .select('mt4_account_id, equity')
      .order('equity', { ascending: true });

    if (snapErr) logger.warn('Admin getUsersOverview: equity_snapshots query failed:', snapErr);

    // Build min equity map per account
    const minEquityMap = {};
    for (const snap of minEquities || []) {
      const aid = snap.mt4_account_id;
      if (minEquityMap[aid] === undefined || snap.equity < minEquityMap[aid]) {
        minEquityMap[aid] = snap.equity;
      }
    }

    // Group accounts by user
    const accountsByUser = {};
    for (const acc of accounts || []) {
      if (!accountsByUser[acc.user_id]) accountsByUser[acc.user_id] = [];

      const balance = Number(acc.balance) || 0;
      const equity = Number(acc.equity) || 0;
      const initialBalance = Number(acc.initial_balance) || 0;

      // Current DD: how much equity dropped below balance (floating loss %)
      const dd = balance > 0 ? ((balance - equity) / balance) * 100 : 0;

      // Max DD: largest drop from initial_balance to lowest equity ever seen
      const minEquity = minEquityMap[acc.id] !== undefined ? Number(minEquityMap[acc.id]) : equity;
      const peak = initialBalance > 0 ? initialBalance : balance;
      const maxDd = peak > 0 ? ((peak - minEquity) / peak) * 100 : 0;

      // Profit from initial: equity - initial_balance
      const profitFromInitial = initialBalance > 0 ? equity - initialBalance : Number(acc.profit) || 0;

      accountsByUser[acc.user_id].push({
        id: acc.id,
        login: acc.login,
        server: acc.server,
        account_name: acc.account_name,
        currency: acc.currency,
        initial_balance: initialBalance,
        balance,
        equity,
        profit: profitFromInitial,
        floating_profit: Number(acc.profit) || 0,
        dd: Math.max(0, dd),
        max_dd: Math.max(0, maxDd),
        is_connected: acc.is_connected,
        last_synced: acc.last_synced,
      });
    }

    const result = (users || []).map((u) => ({
      ...u,
      accounts: accountsByUser[u.id] || [],
    }));

    return res.json({ users: result });
  } catch (err) {
    logger.error('GetUsersOverview exception:', err);
    return res.status(500).json({ error: 'Failed to fetch users overview' });
  }
};

// PUT /api/admin/accounts/:id — update initial_balance
const updateAccountMeta = async (req, res) => {
  const { id } = req.params;
  const { initial_balance } = req.body;

  const update = {};
  if (initial_balance !== undefined) {
    const val = Number(initial_balance);
    if (isNaN(val) || val < 0) return res.status(400).json({ error: 'initial_balance tidak valid' });
    update.initial_balance = val;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'Tidak ada field yang diupdate' });
  }

  try {
    const { data, error } = await supabase
      .from('mt4_accounts')
      .update(update)
      .eq('id', id)
      .select('id, account_name, initial_balance')
      .single();

    if (error) throw error;
    return res.json({ account: data });
  } catch (err) {
    logger.error('UpdateAccountMeta exception:', err);
    return res.status(500).json({ error: 'Gagal mengupdate akun' });
  }
};

// POST /api/admin/accounts — create MT4 account for a specific user
const addAccountForUser = async (req, res) => {
  const { user_id, login, server, account_name, currency, initial_balance } = req.body;

  if (!user_id || !login || !server) {
    return res.status(400).json({ error: 'user_id, login, dan server wajib diisi' });
  }

  // Verify user exists
  const { data: targetUser, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('id', user_id)
    .single();

  if (userErr || !targetUser) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  try {
    // Check if account already exists for this user
    const { data: existing } = await supabase
      .from('mt4_accounts')
      .select('id')
      .eq('user_id', user_id)
      .eq('login', String(login))
      .eq('server', server)
      .single();

  const effectiveCurrency = currency || 'USD';
  // Normalize initial_balance: USC cents → divide by 100 to store as USD equivalent
  const normalizedInitialBalance = initial_balance
    ? (effectiveCurrency === 'USC' ? Number(initial_balance) / 100 : Number(initial_balance))
    : 0;

  let account;
    if (existing) {
      const { data, error } = await supabase
        .from('mt4_accounts')
        .update({
          account_name: account_name || `Account ${login}`,
          ...(currency ? { currency } : {}),
          ...(initial_balance !== undefined ? { initial_balance: normalizedInitialBalance } : {}),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      account = data;
    } else {
      const { data, error } = await supabase
        .from('mt4_accounts')
        .insert({
          user_id,
          login: String(login),
          server,
          account_name: account_name || `Account ${login}`,
          currency: effectiveCurrency,
          leverage: 100,
          initial_balance: normalizedInitialBalance,
          balance: 0,
          equity: 0,
          margin: 0,
          free_margin: 0,
          profit: 0,
          is_connected: false,
        })
        .select()
        .single();
      if (error) throw error;
      account = data;
    }

    return res.status(201).json({ account });
  } catch (err) {
    logger.error('AddAccountForUser exception:', err);
    return res.status(500).json({ error: 'Gagal membuat akun' });
  }
};

module.exports = { getUsersOverview, updateAccountMeta, addAccountForUser };
