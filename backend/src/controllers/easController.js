const supabase = require('../config/supabase');
const logger = require('../config/logger');

// Helper: compute total investment + total investors per EA from connected MT4 accounts
const fetchEAStats = async () => {
  const { data, error } = await supabase
    .from('mt4_accounts')
    .select('ea_id, balance, currency, user_id')
    .not('ea_id', 'is', null)
    .eq('is_connected', true);
  if (error) return { totals: {}, investors: {} };
  const totals = {};
  const investorSets = {};
  for (const acc of data || []) {
    if (!acc.ea_id) continue;
    const usd = (Number(acc.balance) || 0) / (acc.currency === 'USC' ? 100 : 1);
    totals[acc.ea_id] = (totals[acc.ea_id] || 0) + usd;
    if (!investorSets[acc.ea_id]) investorSets[acc.ea_id] = new Set();
    investorSets[acc.ea_id].add(acc.user_id);
  }
  const investors = {};
  for (const [eaId, set] of Object.entries(investorSets)) {
    investors[eaId] = set.size;
  }
  return { totals, investors };
};

// GET /api/eas — public list of active EAs
const listEAs = async (_req, res) => {
  try {
    const [{ data, error }, { totals, investors }] = await Promise.all([
      supabase
        .from('expert_advisors')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      fetchEAStats(),
    ]);
    if (error) throw error;
    const eas = (data || []).map((ea) => ({
      ...ea,
      total_investment_usd: totals[ea.id] != null ? parseFloat(totals[ea.id].toFixed(2)) : null,
      total_investors: investors[ea.id] || 0,
    }));
    return res.json({ eas });
  } catch (err) {
    logger.error('listEAs exception:', err);
    return res.status(500).json({ error: 'Failed to fetch EAs' });
  }
};

// GET /api/admin/eas — admin: list all (incl. inactive)
const adminListEAs = async (_req, res) => {
  try {
    const [{ data, error }, { totals, investors }] = await Promise.all([
      supabase
        .from('expert_advisors')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      fetchEAStats(),
    ]);
    if (error) throw error;
    const eas = (data || []).map((ea) => ({
      ...ea,
      total_investment_usd: totals[ea.id] != null ? parseFloat(totals[ea.id].toFixed(2)) : null,
      total_investors: investors[ea.id] || 0,
    }));
    return res.json({ eas });
  } catch (err) {
    logger.error('adminListEAs exception:', err);
    return res.status(500).json({ error: 'Failed to fetch EAs' });
  }
};

const sanitize = (body) => {
  const allowed = ['name', 'tagline', 'description', 'myfxbook_url', 'widget_url', 'widget_link', 'tracking_start', 'tags', 'status', 'is_active', 'sort_order', 'min_equity'];
  const out = {};
  for (const k of allowed) {
    if (body[k] === undefined) continue;
    if (k === 'tags') {
      out.tags = Array.isArray(body.tags)
        ? body.tags.map((t) => String(t).trim()).filter(Boolean)
        : String(body.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
    } else if (k === 'tracking_start') {
      out.tracking_start = body.tracking_start || null;
    } else if (k === 'is_active') {
      out.is_active = !!body.is_active;
    } else if (k === 'sort_order') {
      out.sort_order = parseInt(body.sort_order) || 0;
    } else if (k === 'min_equity') {
      out.min_equity = body.min_equity !== '' && body.min_equity != null
        ? parseFloat(body.min_equity) || null
        : null;
    } else {
      out[k] = body[k] === '' ? null : body[k];
    }
  }
  return out;
};

const createEA = async (req, res) => {
  const payload = sanitize(req.body);
  if (!payload.name) return res.status(400).json({ error: 'name wajib diisi' });
  try {
    const { data, error } = await supabase
      .from('expert_advisors')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return res.status(201).json({ ea: data });
  } catch (err) {
    logger.error('createEA exception:', err);
    return res.status(500).json({ error: 'Failed to create EA' });
  }
};

const updateEA = async (req, res) => {
  const { id } = req.params;
  const payload = sanitize(req.body);
  payload.updated_at = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from('expert_advisors')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return res.json({ ea: data });
  } catch (err) {
    logger.error('updateEA exception:', err);
    return res.status(500).json({ error: 'Failed to update EA' });
  }
};

const deleteEA = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('expert_advisors').delete().eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    logger.error('deleteEA exception:', err);
    return res.status(500).json({ error: 'Failed to delete EA' });
  }
};

module.exports = { listEAs, adminListEAs, createEA, updateEA, deleteEA };
