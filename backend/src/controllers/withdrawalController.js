const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/withdrawals
// User: sees only own. Admin: sees all (optional ?status filter)
const getWithdrawals = async (req, res) => {
  const { status, type, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabase
      .from('withdrawals')
      .select(
        `id, ticket, amount, currency, type, comment, close_time, status, admin_notes, created_at, updated_at,
         mt4_account_id,
         mt4_accounts(account_name, login, server, currency),
         users(full_name, email)`,
        { count: 'exact' }
      )
      .order('close_time', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (req.user.role !== 'admin') {
      query = query.eq('user_id', req.user.id);
    } else if (req.query.user_id) {
      query = query.eq('user_id', req.query.user_id);
    }

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({
      withdrawals: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (err) {
    logger.error('GetWithdrawals exception:', err);
    return res.status(500).json({ error: 'Gagal mengambil data withdraw' });
  }
};

// PUT /api/withdrawals/:id/status  — Admin only
const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, admin_notes } = req.body;

  const VALID = ['verified', 'rejected'];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `status harus salah satu dari: ${VALID.join(', ')}` });
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('withdrawals')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Withdrawal tidak ditemukan' });

    const { data, error } = await supabase
      .from('withdrawals')
      .update({ status, admin_notes: admin_notes || null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Withdrawal ${id} status updated to ${status} by admin ${req.user.id}`);
    return res.json({ message: 'Status berhasil diperbarui', withdrawal: data });
  } catch (err) {
    logger.error('UpdateWithdrawalStatus exception:', err);
    return res.status(500).json({ error: 'Gagal memperbarui status' });
  }
};

module.exports = { getWithdrawals, updateStatus };


// POST /api/withdrawals
const createWithdrawal = async (req, res) => {
  const { amount, currency, mt4_account_id, bank_name, account_number, account_name, notes } = req.body;

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount harus lebih dari 0' });
  }
  if (!bank_name || !account_number || !account_name) {
    return res.status(400).json({ error: 'bank_name, account_number, dan account_name wajib diisi' });
  }

  try {
    // Verify mt4_account_id belongs to this user (if provided)
    if (mt4_account_id) {
      const { data: acc, error: accErr } = await supabase
        .from('mt4_accounts')
        .select('id')
        .eq('id', mt4_account_id)
        .eq('user_id', req.user.id)
        .single();
      if (accErr || !acc) {
        return res.status(404).json({ error: 'MT4 account tidak ditemukan' });
      }
    }

    const { data, error } = await supabase
      .from('withdrawals')
      .insert({
        user_id: req.user.id,
        mt4_account_id: mt4_account_id || null,
        amount: Number(amount),
        currency: currency || 'USD',
        status: 'pending',
        bank_name,
        account_number,
        account_name,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Withdrawal request created: id=${data.id}, user=${req.user.id}, amount=${amount}`);
    return res.status(201).json({ message: 'Permintaan withdraw berhasil dikirim', withdrawal: data });
  } catch (err) {
    logger.error('CreateWithdrawal exception:', err);
    return res.status(500).json({ error: 'Gagal membuat permintaan withdraw' });
  }
};

// GET /api/withdrawals
// User: sees only own records. Admin: sees all (with optional ?user_id filter)
const getWithdrawals = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabase
      .from('withdrawals')
      .select(
        `id, amount, currency, status, bank_name, account_number, account_name,
         notes, admin_notes, processed_at, created_at, updated_at,
         mt4_account_id,
         mt4_accounts(account_name, login, server),
         users(full_name, email)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    // Non-admin can only see their own
    if (req.user.role !== 'admin') {
      query = query.eq('user_id', req.user.id);
    } else if (req.query.user_id) {
      query = query.eq('user_id', req.query.user_id);
    }

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({
      withdrawals: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (err) {
    logger.error('GetWithdrawals exception:', err);
    return res.status(500).json({ error: 'Gagal mengambil data withdraw' });
  }
};

// GET /api/withdrawals/:id
const getWithdrawal = async (req, res) => {
  const { id } = req.params;

  try {
    let query = supabase
      .from('withdrawals')
      .select(
        `id, amount, currency, status, bank_name, account_number, account_name,
         notes, admin_notes, processed_at, created_at, updated_at,
         mt4_account_id,
         mt4_accounts(account_name, login, server),
         users(full_name, email)`
      )
      .eq('id', id)
      .single();

    const { data, error } = await query;
    if (error || !data) return res.status(404).json({ error: 'Withdrawal tidak ditemukan' });

    // Non-admin can only view own
    if (req.user.role !== 'admin' && data.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    return res.json({ withdrawal: data });
  } catch (err) {
    logger.error('GetWithdrawal exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/withdrawals/:id/status  — Admin only
const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, admin_notes } = req.body;

  const VALID = ['approved', 'rejected', 'processed'];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `status harus salah satu dari: ${VALID.join(', ')}` });
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('withdrawals')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Withdrawal tidak ditemukan' });
    if (existing.status === 'processed') {
      return res.status(400).json({ error: 'Withdrawal sudah diproses, tidak bisa diubah' });
    }

    const updatePayload = {
      status,
      admin_notes: admin_notes || null,
      updated_at: new Date().toISOString(),
    };
    if (status === 'processed') {
      updatePayload.processed_at = new Date().toISOString();
      updatePayload.processed_by = req.user.id;
    }

    const { data, error } = await supabase
      .from('withdrawals')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Withdrawal ${id} status updated to ${status} by admin ${req.user.id}`);
    return res.json({ message: 'Status berhasil diperbarui', withdrawal: data });
  } catch (err) {
    logger.error('UpdateWithdrawalStatus exception:', err);
    return res.status(500).json({ error: 'Gagal memperbarui status' });
  }
};

// DELETE /api/withdrawals/:id — user can cancel pending, admin can delete any
const deleteWithdrawal = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('withdrawals')
      .select('id, status, user_id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Withdrawal tidak ditemukan' });

    // User can only cancel own pending request
    if (req.user.role !== 'admin') {
      if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'Akses ditolak' });
      if (existing.status !== 'pending') {
        return res.status(400).json({ error: 'Hanya request pending yang bisa dibatalkan' });
      }
    }

    const { error } = await supabase.from('withdrawals').delete().eq('id', id);
    if (error) throw error;

    return res.json({ message: 'Permintaan withdraw dibatalkan' });
  } catch (err) {
    logger.error('DeleteWithdrawal exception:', err);
    return res.status(500).json({ error: 'Gagal membatalkan withdraw' });
  }
};

module.exports = { createWithdrawal, getWithdrawals, getWithdrawal, updateStatus, deleteWithdrawal };
