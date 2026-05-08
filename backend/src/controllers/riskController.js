const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/accounts/:id/risk
const getRiskSettings = async (req, res) => {
  try {
    const { data: account, error } = await supabase
      .from('mt4_accounts')
      .select('id, account_name, equity, equity_stop_loss, risk_enabled')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.json({ account });
  } catch (err) {
    logger.error('getRiskSettings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/accounts/:id/risk
const updateRiskSettings = async (req, res) => {
  const { equity_stop_loss, risk_enabled } = req.body;

  const update = {};
  if (equity_stop_loss !== undefined) {
    update.equity_stop_loss = equity_stop_loss !== null && equity_stop_loss !== '' ? Number(equity_stop_loss) : null;
  }
  if (risk_enabled !== undefined) {
    update.risk_enabled = Boolean(risk_enabled);
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const { data: account, error } = await supabase
      .from('mt4_accounts')
      .update(update)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, account_name, equity, equity_stop_loss, risk_enabled')
      .single();

    if (error || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.json({ account });
  } catch (err) {
    logger.error('updateRiskSettings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getRiskSettings, updateRiskSettings };
