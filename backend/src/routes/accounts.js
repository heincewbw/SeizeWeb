const express = require('express');
const router = express.Router();
const { getAccounts, connectAccount, deleteAccount, disconnectAccount, syncAccount } = require('../controllers/accountController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getAccounts);
router.post('/connect', connectAccount);
router.delete('/:id', deleteAccount);
router.post('/:id/disconnect', disconnectAccount);
router.post('/:id/sync', syncAccount);

module.exports = router;
