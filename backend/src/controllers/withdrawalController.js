const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/withdrawals
// User: sees only own. Admin: sees all (optional ?status filter)
const getWithdrawals = async (req, res) => {
  const { status, type, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    // Try full select (works after running fix_withdrawals_columns.sql migration)
    let query = supabase
      .from('withdrawals')
      .select(
        `id, amount, currency, status, admin_notes, notes, bank_name, processed_at, created_at, updated_at,
         ticket, type, comment, close_time,
         mt4_account_id,
         mt4_accounts(account_name, login, server, currency),
         users!withdrawals_user_id_fkey(full_name, email)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (req.user.role !== 'admin') {
      query = query.eq('user_id', req.user.id);
    } else if (req.query.user_id) {
      query = query.eq('user_id', req.query.user_id);
    }

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    let { data, error, count } = await query;

    // Fallback: if some columns don't exist yet (migration not run), retry with safe columns only
    if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
      logger.warn('GetWithdrawals: some columns missing, using fallback query. Run fix_withdrawals_columns.sql migration.');
      let fallback = supabase
        .from('withdrawals')
        .select(
          `id, amount, currency, status, admin_notes, notes, bank_name, processed_at, created_at, updated_at,
           mt4_account_id,
           mt4_accounts(account_name, login, server, currency),
           users!withdrawals_user_id_fkey(full_name, email)`,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      if (req.user.role !== 'admin') {
        fallback = fallback.eq('user_id', req.user.id);
      } else if (req.query.user_id) {
        fallback = fallback.eq('user_id', req.query.user_id);
      }

      if (status) fallback = fallback.eq('status', status);

      const fallbackResult = await fallback;
      data = fallbackResult.data;
      error = fallbackResult.error;
      count = fallbackResult.count;
    }

    if (error) throw error;

    // Normalize: map notes→comment and close_time fallback for backward compat
    const normalized = (data || []).map((w) => ({
      ...w,
      comment: w.comment ?? w.notes ?? '',
      close_time: w.close_time ?? w.created_at,
      type: w.type ?? 'withdrawal',
    }));

    return res.json({
      withdrawals: normalized,
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

// PUT /api/withdrawals/:id/status  â€” Admin only
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
