const supabase = require('../config/supabase');
const logger = require('../config/logger');

// GET /api/notifications
const getNotifications = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const [{ data, error, count }, { count: unreadCount }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('is_read', false),
    ]);

    if (error) throw error;

    return res.json({
      notifications: data || [],
      unread_count: unreadCount || 0,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (err) {
    logger.error('getNotifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    logger.error('markAllRead error:', err);
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
};

// PUT /api/notifications/:id/read
const markOneRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    logger.error('markOneRead error:', err);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    logger.error('deleteNotification error:', err);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
};

module.exports = { getNotifications, markAllRead, markOneRead, deleteNotification };
