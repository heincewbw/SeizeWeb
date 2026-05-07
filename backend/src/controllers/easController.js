const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/eas — public list of active EAs (auth required)
const listEAs = async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('expert_advisors')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json({ eas: data || [] });
  } catch (err) {
    logger.error('listEAs exception:', err);
    return res.status(500).json({ error: 'Failed to fetch EAs' });
  }
};

// GET /api/admin/eas — admin: list all (incl. inactive)
const adminListEAs = async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('expert_advisors')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json({ eas: data || [] });
  } catch (err) {
    logger.error('adminListEAs exception:', err);
    return res.status(500).json({ error: 'Failed to fetch EAs' });
  }
};

const sanitize = (body) => {
  const allowed = ['name', 'tagline', 'description', 'myfxbook_url', 'widget_url', 'widget_link', 'tracking_start', 'tags', 'status', 'is_active', 'sort_order', 'total_investment_usd'];
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
    } else if (k === 'total_investment_usd') {
      out.total_investment_usd = body.total_investment_usd !== '' && body.total_investment_usd != null
        ? parseFloat(body.total_investment_usd) || null
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
