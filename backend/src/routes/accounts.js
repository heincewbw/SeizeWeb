const express = require('express');
const router = express.Router();
const { getAccounts, connectAccount, deleteAccount, disconnectAccount, syncAccount } = require('../controllers/accountController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getAccounts);
router.post('/connect', requireAdmin, connectAccount);
router.delete('/:id', requireAdmin, deleteAccount);
router.post('/:id/disconnect', requireAdmin, disconnectAccount);
router.post('/:id/sync', requireAdmin, syncAccount);

module.exports = router;
