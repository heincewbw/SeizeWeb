const supabase = require('../config/supabase');
const logger = require('../config/logger');

/**
 * Create a notification and optionally push it via Socket.IO.
 * @param {string} userId
 * @param {{ type: string, title: string, message: string, data?: object }} payload
 * @param {import('socket.io').Server|null} io
 */
const createNotification = async (userId, { type, title, message, data = null }, io = null) => {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, type, title, message, data })
      .select()
      .single();

    if (error) {
      logger.error('createNotification error:', error);
      return null;
    }

    if (io && notification) {
      io.to(`user:${userId}`).emit('notification', notification);
    }

    return notification;
  } catch (err) {
    logger.error('createNotification exception:', err);
    return null;
  }
};

module.exports = { createNotification };
