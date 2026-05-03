const express = require('express');
const router = express.Router();
const { getBridgeToken, receiveMT4Push, eaAutoRegister, getEaVersion, getEaDownload } = require('../controllers/mt4PushController');
const { authenticateToken } = require('../middleware/auth');

const { requireAdmin } = require('../middleware/auth');

// GET /api/mt4/token?login=xxx&server=xxx  (admin only)
router.get('/token', authenticateToken, requireAdmin, getBridgeToken);

// POST /api/mt4/push  (authenticated via bridge token, NOT user JWT)
router.post('/push', receiveMT4Push);

// POST /api/mt4/ea-autoregister  (authenticated via EA_SECRET, no user JWT needed)
router.post('/ea-autoregister', eaAutoRegister);

// GET /api/mt4/ea-version  (public — EA checks for updates)
router.get('/ea-version', getEaVersion);

// GET /api/mt4/ea-download  (public — EA downloads latest .ex4)
router.get('/ea-download', getEaDownload);

module.exports = router;
