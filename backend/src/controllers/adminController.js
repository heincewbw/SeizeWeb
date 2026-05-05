const supabase = require('../config/supabase');
const logger = require('../config/logger');
const https = require('https');

// Helper: fetch USD/IDR rate from frankfurter.app (free, no key required)
const fetchUsdIdrRate = () => {
  return new Promise((resolve) => {
    const req = https.get('https://api.frankfurter.app/latest?from=USD&to=IDR', (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(Math.round(json.rates?.IDR || 16000));
        } catch {
          resolve(16000);
        }
      });
    });
    req.on('error', () => resolve(16000));
    req.setTimeout(8000, () => { req.destroy(); resolve(16000); });
  });
};

// GET /api/admin/users-overview
// Returns all users with their MT4 accounts and calculated stats
const getUsersOverview = async (req, res) => {
  try {
    // Fetch all users
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_active, created_at, commission_rate')
      .order('full_name', { ascending: true });

    if (usersErr) throw usersErr;

    // Fetch all MT4 accounts with their data
    const { data: accounts, error: accErr } = await supabase
      .from('mt4_accounts')
      .select(
        'id, user_id, login, server, account_name, currency, initial_balance, balance, equity, profit, is_connected, last_synced, nama_provider, ip_vps, email_vps, email_exness'
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
        nama_provider: acc.nama_provider,
        ip_vps: acc.ip_vps,
        email_vps: acc.email_vps,
        email_exness: acc.email_exness,
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
  const { user_id, login, server, account_name, currency, initial_balance,
          nama_provider, ip_vps, email_vps, email_exness } = req.body;

  if (!user_id || !login || !server) {
    return res.status(400).json({ error: 'user_id, login, dan server wajib diisi' });
  }
  if (!nama_provider || !ip_vps || !email_vps || !email_exness) {
    return res.status(400).json({ error: 'nama_provider, ip_vps, email_vps, dan email_exness wajib diisi' });
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
          nama_provider,
          ip_vps,
          email_vps,
          email_exness,
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
          nama_provider,
          ip_vps,
          email_vps,
          email_exness,
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

// POST /api/admin/test-offline-alert
// Sends a test offline alert email to all admin users immediately
const { sendMailOrThrow } = require('../services/emailService');

const testOfflineAlert = async (req, res) => {
  try {
    const { data: admins, error: adminErr } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (adminErr) throw new Error(`Supabase error: ${adminErr.message}`);

    if (!admins || admins.length === 0) {
      return res.status(404).json({ error: 'Tidak ada admin user yang aktif' });
    }

    const fakeAccount = {
      login: '12345678',
      server: 'Exness-Real35',
      account_name: 'Test Account',
      lastSyncedStr: new Date(Date.now() - 75 * 60 * 1000).toUTCString(), // 75 min ago
    };

    const rows = `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;">${fakeAccount.login}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;">${fakeAccount.server}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;">${fakeAccount.account_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#f87171;">${fakeAccount.lastSyncedStr}</td>
      </tr>`;

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;">
        <h2 style="color:#f43f5e;margin-top:0;">⚠️ MT4 Account Offline Alert <span style="font-size:14px;background:#1e293b;padding:3px 8px;border-radius:6px;margin-left:8px;">TEST</span></h2>
        <p style="color:#94a3b8;">The following MT4 account(s) have not pushed data for <strong>more than 1 hour</strong>:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#1e293b;">
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;">Login</th>
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;">Server</th>
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;">Account Name</th>
              <th style="padding:8px 12px;text-align:left;color:#94a3b8;">Last Seen</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">
          Ini adalah test email dari AceCapital. Email ini dikirim pada ${new Date().toUTCString()}.
        </p>
      </div>`;

    const subject = '[AceCapital] TEST — MT4 Account Offline Alert';
    const sent = [];
    for (const admin of admins) {
      await sendMailOrThrow(admin.email, subject, html);
      sent.push(admin.email);
    }

    logger.info(`testOfflineAlert: test email sent to ${sent.join(', ')}`);
    return res.json({ success: true, sentTo: sent });
  } catch (err) {
    const errMsg = err.message || String(err) || 'unknown error';
    logger.error(`testOfflineAlert error: ${errMsg} | code=${err.code} | stack=${err.stack}`);
    return res.status(500).json({ error: errMsg, code: err.code });
  }
};

/**
 * POST /api/admin/sync-withdrawals
 * Backfill withdrawals from trade_history without restarting the EA.
 * Body: { account_id? } — omit to sync all accounts.
 */
const syncWithdrawals = async (req, res) => {
  try {
    const { account_id } = req.body;

    // Fetch BALANCE entries with negative profit from trade_history
    let query = supabase
      .from('trade_history')
      .select('mt4_account_id, user_id, ticket, profit, comment, close_time')
      .eq('type', 'BALANCE')
      .lt('profit', 0);

    if (account_id) query = query.eq('mt4_account_id', account_id);

    const { data: balanceRows, error: fetchErr } = await query;
    if (fetchErr) throw new Error(`trade_history query failed: ${fetchErr.message}`);

    if (!balanceRows || balanceRows.length === 0) {
      return res.json({ success: true, inserted: 0, message: 'No BALANCE withdrawal entries found in trade_history' });
    }

    // Fetch currency for each involved account (separate query, no join)
    const accountIds = [...new Set(balanceRows.map((r) => r.mt4_account_id))];
    const { data: accountRows } = await supabase
      .from('mt4_accounts')
      .select('id, currency')
      .in('id', accountIds);
    const currencyMap = {};
    for (const a of accountRows || []) currencyMap[a.id] = a.currency;

    // Get already-tracked tickets so we don't duplicate
    const { data: existing } = await supabase
      .from('withdrawals')
      .select('mt4_account_id, ticket')
      .in('mt4_account_id', accountIds);
    const existingSet = new Set((existing || []).map((r) => `${r.mt4_account_id}:${r.ticket}`));

    const detectType = (comment) => {
      const c = (comment || '').toUpperCase();
      return c.includes('-INT-') ? 'transfer' : 'withdrawal';
    };

    const newRows = balanceRows
      .filter((h) => !existingSet.has(`${h.mt4_account_id}:${h.ticket}`))
      .map((h) => ({
        mt4_account_id: h.mt4_account_id,
        user_id: h.user_id,
        ticket: h.ticket,
        amount: Math.abs(Number(h.profit)),
        currency: currencyMap[h.mt4_account_id] || 'USD',
        type: detectType(h.comment),
        comment: h.comment || '',
        close_time: h.close_time,
        status: 'detected',
      }));

    if (newRows.length === 0) {
      return res.json({ success: true, inserted: 0, message: 'All withdrawals already synced' });
    }

    const { error: insertErr } = await supabase.from('withdrawals').insert(newRows);
    if (insertErr) throw new Error(`withdrawals insert failed: ${insertErr.message}`);

    logger.info(`syncWithdrawals: inserted ${newRows.length} withdrawal(s)${account_id ? ` for account ${account_id}` : ''}`);
    return res.json({ success: true, inserted: newRows.length });
  } catch (err) {
    logger.error('syncWithdrawals error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// PUT /api/admin/users/:userId/commission
// Update commission_rate for a user
const updateCommissionRate = async (req, res) => {
  const { userId } = req.params;
  const { commission_rate } = req.body;
  const rate = Number(commission_rate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    return res.status(400).json({ error: 'commission_rate harus antara 0 dan 100' });
  }
  try {
    const { error } = await supabase
      .from('users')
      .update({ commission_rate: rate })
      .eq('id', userId);
    if (error) throw error;
    return res.json({ success: true, commission_rate: rate });
  } catch (err) {
    logger.error('updateCommissionRate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/invoice?user_id=&month=&year=
// Generate invoice data for a user for a specific month/year
const generateInvoice = async (req, res) => {
  const { user_id, month, year } = req.query;
  if (!user_id || !month || !year) {
    return res.status(400).json({ error: 'user_id, month, year wajib diisi' });
  }

  try {
    // Fetch user
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, full_name, email, commission_rate')
      .eq('id', user_id)
      .single();
    if (userErr || !user) return res.status(404).json({ error: 'User tidak ditemukan' });

    // Fetch accounts
    const { data: accounts, error: accErr } = await supabase
      .from('mt4_accounts')
      .select('id, login, account_name, currency, initial_balance, equity')
      .eq('user_id', user_id);
    if (accErr) throw accErr;

    // Fetch USD/IDR rate
    const rate = await fetchUsdIdrRate();

    const commissionRate = Number(user.commission_rate) || 10;
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Build month date range for display
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0); // last day of month
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthName = monthNames[monthNum - 1];

    const formatDate = (d) => `${String(d.getDate()).padStart(2,'0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    const now = new Date();
    const invoiceDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    // Generate invoice ID
    const invoiceId = `INV-AC-${yearNum}${String(monthNum).padStart(2,'0')}-${user_id.slice(-6).toUpperCase()}`;

    let totalProfitUSD = 0;
    let totalCommUSD = 0;

    const rows = (accounts || []).map((acc) => {
      const divisor = acc.currency === 'USC' ? 100 : 1;
      const equity = (Number(acc.equity) || 0) / divisor;
      const initialBalance = (Number(acc.initial_balance) || 0) / divisor;

      // Profit rounded down to nearest $10
      const rawProfit = Math.max(0, equity - initialBalance);
      const profitUSD = Math.floor(rawProfit / 10) * 10;
      const commUSD = parseFloat((profitUSD * commissionRate / 100).toFixed(2));

      totalProfitUSD += profitUSD;
      totalCommUSD += commUSD;

      // Invoice number per account
      const invoiceNum = `INV-AC-${acc.login}-${yearNum}${String(monthNum).padStart(2,'0')}`;

      return {
        invoiceNumber: invoiceNum,
        accountName: acc.account_name || acc.login,
        login: acc.login,
        currency: acc.currency,
        equity,
        initialBalance,
        profitUSD,
        profitIDR: Math.round(profitUSD * rate),
        commUSD,
        commIDR: Math.round(commUSD * rate),
      };
    });

    return res.json({
      invoiceId,
      invoiceDate,
      period: `${monthName} ${yearNum}`,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      user: { full_name: user.full_name, email: user.email },
      commissionRate,
      rate,
      rows,
      totalProfitUSD: parseFloat(totalProfitUSD.toFixed(2)),
      totalProfitIDR: Math.round(totalProfitUSD * rate),
      totalCommUSD: parseFloat(totalCommUSD.toFixed(2)),
      totalCommIDR: Math.round(totalCommUSD * rate),
    });
  } catch (err) {
    logger.error(`generateInvoice error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getUsersOverview, updateAccountMeta, addAccountForUser, deleteAccount, reassignAccount, testOfflineAlert, syncWithdrawals, updateCommissionRate, generateInvoice };
