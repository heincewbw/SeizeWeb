const express = require('express');
const router = express.Router();
const { getSummary, getEquityChart, getSymbolBreakdown } = require('../controllers/statsController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/summary', getSummary);
router.get('/equity-chart', getEquityChart);
router.get('/symbol-breakdown', getSymbolBreakdown);

module.exports = router;
