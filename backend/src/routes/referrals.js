const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getReferrals } = require('../controllers/referralController');

router.get('/', authenticateToken, getReferrals);

module.exports = router;
