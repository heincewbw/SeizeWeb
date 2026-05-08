const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
} = require('../controllers/notificationController');

router.get('/', authenticateToken, getNotifications);
router.put('/read-all', authenticateToken, markAllRead);
router.put('/:id/read', authenticateToken, markOneRead);
router.delete('/:id', authenticateToken, deleteNotification);

module.exports = router;
