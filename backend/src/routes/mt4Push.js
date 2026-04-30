const express = require('express');
const router = express.Router();
const { getBridgeToken, receiveMT4Push } = require('../controllers/mt4PushController');
const { authenticateToken } = require('../middleware/auth');

const { requireAdmin } = require('../middleware/auth');

// GET /api/mt4/token?login=xxx&server=xxx  (admin only)
router.get('/token', authenticateToken, requireAdmin, getBridgeToken);

// POST /api/mt4/push  (authenticated via bridge token, NOT user JWT)
router.post('/push', receiveMT4Push);

module.exports = router;
