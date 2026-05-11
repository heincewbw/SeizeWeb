const express = require('express');
const router = express.Router();
const { getOpenPositions, getTradeHistory, getTradeHistoryDaily, syncTradeHistory } = require('../controllers/positionsController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getOpenPositions);
router.get('/history/daily', getTradeHistoryDaily);
router.get('/history', getTradeHistory);
router.post('/sync-history/:accountId', syncTradeHistory);

module.exports = router;
