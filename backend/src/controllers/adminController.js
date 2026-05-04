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
      .order('created_at', { ascending: true });

    if (accErr) throw accErr;

    // Fetch min equity per account from equity_snapshots (for Max DD calculation)
    const { data: minEquities, error: snapMinErr } = await supabase
      .from('equity_snapshots')
      .select('mt4_account_id, equity')
      .order('equity', { ascending: true });

    if (snapMinErr) logger.warn('Admin getUsersOverview: equity_snapshots min query failed:', snapMinErr);

    // Fetch max equity per account (peak equity ever reached)
    const { data: maxEquities, error: snapMaxErr } = await supabase
      .from('equity_snapshots')
      .select('mt4_account_id, equity')
      .order('equity', { ascending: false });

    if (snapMaxErr) logger.warn('Admin getUsersOverview: equity_snapshots max query failed:', snapMaxErr);

    // Build min equity map per account
    const minEquityMap = {};
    for (const snap of minEquities || []) {
      const aid = snap.mt4_account_id;
      if (minEquityMap[aid] === undefined || snap.equity < minEquityMap[aid]) {
        minEquityMap[aid] = snap.equity;
      }
    }

    // Build max equity map per account
    const maxEquityMap = {};
    for (const snap of maxEquities || []) {
      const aid = snap.mt4_account_id;
      if (maxEquityMap[aid] === undefined || snap.equity > maxEquityMap[aid]) {
        maxEquityMap[aid] = snap.equity;
      }
    }

    // Group accounts by user
    const accountsByUser = {};
    for (const acc of accounts || []) {
      if (!accountsByUser[acc.user_id]) accountsByUser[acc.user_id] = [];

      // USC (US Cents): backend stores raw cents from MT4, normalize to USD for all calculations
      const divisor = acc.currency === 'USC' ? 100 : 1;
      const balance = (Number(acc.balance)          || 0) / divisor;
      const equity  = (Number(acc.equity)           || 0) / divisor;
      const initialBalance = (Number(acc.initial_balance) || 0) / divisor;  // stored as cents for USC, same convention as balance/equity

      // Current DD: how much equity dropped below balance (floating loss %)
      const dd = balance > 0 ? ((balance - equity) / balance) * 100 : 0;

      // Max DD: (peakEquity - minEquity) / peakEquity
      // Peak = highest of: initialBalance, max snapshot equity, current balance
      const rawMinEquity = minEquityMap[acc.id] !== undefined ? Number(minEquityMap[acc.id]) : (Number(acc.equity) || 0);
      const rawMaxEquity = maxEquityMap[acc.id] !== undefined ? Number(maxEquityMap[acc.id]) : (Number(acc.equity) || 0);
      const minEquity = rawMinEquity / divisor;
      const maxSnapshotEquity = rawMaxEquity / divisor;
      const peak = Math.max(
        initialBalance > 0 ? initialBalance : 0,
        maxSnapshotEquity,
        balance,
      );
      const maxDd = peak > 0 ? ((peak - minEquity) / peak) * 100 : 0;

      // Profit from initial: equity - initial_balance
      const profitFromInitial = initialBalance > 0 ? equity - initialBalance : (Number(acc.profit) || 0) / divisor;

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
        floating_profit: (Number(acc.profit) || 0) / divisor,
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
    // Check if account already exists globally (login+server is now unique across all users)
    const { data: existing } = await supabase
      .from('mt4_accounts')
      .select('id, user_id')
      .eq('login', String(login))
      .eq('server', server)
      .single();

    // If account exists under a DIFFERENT user, reject
    if (existing && existing.user_id !== user_id) {
      return res.status(409).json({ error: `Akun ${login}@${server} sudah terdaftar di bawah investor lain` });
    }

  const effectiveCurrency = currency || 'USD';
  // initial_balance stored as cents for USC (same convention as balance/equity from EA)
  // Admin enters value in USD → multiply by 100 to store as cents for USC
  const normalizedInitialBalance = initial_balance
    ? (effectiveCurrency === 'USC' ? Number(initial_balance) * 100 : Number(initial_balance))
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

// DELETE /api/admin/accounts/:id — hard delete account + all related data
const deleteAccount = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('mt4_accounts')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    logger.error('DeleteAccount exception:', err);
    return res.status(500).json({ error: 'Gagal menghapus akun' });
  }
};

// PUT /api/admin/accounts/:id/reassign — move account to another user
const reassignAccount = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id wajib diisi' });

  try {
    const { data: targetUser, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single();
    if (userErr || !targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });

    const { data, error } = await supabase
      .from('mt4_accounts')
      .update({ user_id })
      .eq('id', id)
      .select('id, login, server, account_name, user_id')
      .single();
    if (error) throw error;

    // Also update user_id in related tables
    await supabase.from('equity_snapshots').update({ user_id }).eq('mt4_account_id', id);
    await supabase.from('open_positions').update({ user_id }).eq('mt4_account_id', id);
    await supabase.from('trade_history').update({ user_id }).eq('mt4_account_id', id);

    return res.json({ account: data });
  } catch (err) {
    logger.error('ReassignAccount exception:', err);
    return res.status(500).json({ error: 'Gagal memindahkan akun' });
  }
};

// POST /api/admin/test-wa-alert — kirim test notif WA untuk akun tertentu (by login)
const testWaAlert = async (req, res) => {
  const { login } = req.body;
  if (!login) return res.status(400).json({ error: 'login wajib diisi' });

  try {
    const { data: acc, error } = await supabase
      .from('mt4_accounts')
      .select('id, login, server, account_name, last_synced')
      .eq('login', String(login))
      .maybeSingle();

    if (error || !acc) return res.status(404).json({ error: `Akun login=${login} tidak ditemukan` });

    const { notifyAdmin } = require('../services/whatsapp');
    const lastSync = acc.last_synced
      ? new Date(acc.last_synced).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : 'tidak diketahui';

    const message =
      `🧪 *SeizeWeb TEST Alert*\n\n` +
      `Ini adalah pesan test notifikasi.\n\n` +
      `• *${acc.account_name || acc.login}* (${acc.login}@${acc.server})\n` +
      `  Last sync: ${lastSync} WIB\n\n` +
      `_Jika pesan ini terkirim, konfigurasi WA berhasil!_ ✅`;

    const sent = await notifyAdmin(message);
    if (sent) {
      return res.json({ success: true, message: 'Test WA terkirim' });
    } else {
      return res.status(500).json({ error: 'Gagal kirim WA — cek FONNTE_TOKEN dan ADMIN_WA_NUMBER di env' });
    }
  } catch (err) {
    logger.error('TestWaAlert exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getUsersOverview, updateAccountMeta, addAccountForUser, deleteAccount, reassignAccount, testWaAlert };
