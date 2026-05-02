const express = require('express');
const router = express.Router();
const { getWithdrawals, updateStatus } = require('../controllers/withdrawalController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getWithdrawals);
router.put('/:id/status', requireAdmin, updateStatus);

module.exports = router;
