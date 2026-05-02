const express = require('express');
const router = express.Router();
const { getUsersOverview, updateAccountMeta } = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/users-overview', getUsersOverview);
router.put('/accounts/:id', updateAccountMeta);

module.exports = router;
