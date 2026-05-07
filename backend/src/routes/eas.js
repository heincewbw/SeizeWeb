const express = require('express');
const router = express.Router();
const { listEAs } = require('../controllers/easController');

// Public endpoint — no auth required
router.get('/', listEAs);

module.exports = router;
