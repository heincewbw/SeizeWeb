const express = require('express');
const router = express.Router();
const { listEAs } = require('../controllers/easController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/', listEAs);

module.exports = router;
