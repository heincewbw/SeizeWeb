const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDeposits } = require('../controllers/depositController');

router.get('/', authenticateToken, getDeposits);

module.exports = router;
