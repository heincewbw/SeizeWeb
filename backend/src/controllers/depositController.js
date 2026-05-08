const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/deposits
// Deposits = BALANCE trade_history records with positive profit
const getDeposits = async (req, res) => {
  const { page = 1, limit = 20, account_id } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabase
      .from('trade_history')
      .select(
        `id, ticket, profit, comment, close_time, created_at,
         mt4_account_id,
         mt4_accounts(account_name, login, server, currency)`,
        { count: 'exact' }
      )
      .eq('user_id', req.user.id)
      .eq('type', 'BALANCE')
      .gt('profit', 0)
      .order('close_time', { ascending: false, nullsFirst: false })
      .range(offset, offset + Number(limit) - 1);

    if (req.user.role === 'admin' && req.query.user_id) {
      query = supabase
        .from('trade_history')
        .select(
          `id, ticket, profit, comment, close_time, created_at,
           mt4_account_id,
           mt4_accounts(account_name, login, server, currency),
           users(full_name, email)`,
          { count: 'exact' }
        )
        .eq('user_id', req.query.user_id)
        .eq('type', 'BALANCE')
        .gt('profit', 0)
        .order('close_time', { ascending: false, nullsFirst: false })
        .range(offset, offset + Number(limit) - 1);
    }

    if (account_id) query = query.eq('mt4_account_id', account_id);

    const { data, error, count } = await query;
    if (error) throw error;

    const deposits = (data || []).map((d) => {
      const divisor = d.mt4_accounts?.currency === 'USC' ? 100 : 1;
      return {
        ...d,
        amount: (Number(d.profit) || 0) / divisor,
        currency: d.mt4_accounts?.currency === 'USC' ? 'USD' : (d.mt4_accounts?.currency || 'USD'),
      };
    });

    return res.json({
      deposits,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (err) {
    logger.error('getDeposits error:', err);
    return res.status(500).json({ error: 'Failed to fetch deposits' });
  }
};

module.exports = { getDeposits };
