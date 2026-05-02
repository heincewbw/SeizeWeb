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
