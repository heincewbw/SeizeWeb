const express = require('express');
const router = express.Router();
const { getUsersOverview, updateAccountMeta, addAccountForUser, deleteAccount, reassignAccount } = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/users-overview', getUsersOverview);
router.put('/accounts/:id', updateAccountMeta);
router.post('/accounts', addAccountForUser);
router.delete('/accounts/:id', deleteAccount);
router.put('/accounts/:id/reassign', reassignAccount);

module.exports = router;
