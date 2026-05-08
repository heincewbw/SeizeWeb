const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../config/logger');

const generateCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

// GET /api/referrals
const getReferrals = async (req, res) => {
  try {
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, referral_code')
      .eq('id', req.user.id)
      .single();

    if (userErr) throw userErr;

    let code = user.referral_code;

    // Auto-generate code if none exists
    if (!code) {
      let newCode;
      for (let i = 0; i < 10; i++) {
        newCode = generateCode();
        const { data: dup } = await supabase.from('users').select('id').eq('referral_code', newCode).maybeSingle();
        if (!dup) break;
      }
      const { data: updated } = await supabase
        .from('users')
        .update({ referral_code: newCode })
        .eq('id', req.user.id)
        .select('referral_code')
        .single();
      code = updated?.referral_code || newCode;
    }

    const { count: totalReferrals } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', req.user.id);

    const { data: referred } = await supabase
      .from('referrals')
      .select('created_at, users!referrals_referred_id_fkey(full_name)')
      .eq('referrer_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const frontendUrl = process.env.FRONTEND_URL || 'https://acecapital.id';

    return res.json({
      referral_code: code,
      referral_url: `${frontendUrl}/register?ref=${code}`,
      total_referrals: totalReferrals || 0,
      referred_users: (referred || []).map((r) => ({
        full_name: r.users?.full_name || 'Investor',
        joined_at: r.created_at,
      })),
    });
  } catch (err) {
    logger.error('getReferrals error:', err);
    return res.status(500).json({ error: 'Failed to fetch referral data' });
  }
};

module.exports = { getReferrals };
