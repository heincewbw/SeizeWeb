const express = require('express');
const router = express.Router();
const { getUsersOverview, updateAccountMeta, addAccountForUser, deleteAccount, reassignAccount, testOfflineAlert, syncWithdrawals, updateCommissionRate, generateInvoice, sendInvoiceEmail, getRevenueDashboard } = require('../controllers/adminController');
const { adminListEAs, createEA, updateEA, deleteEA } = require('../controllers/easController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/users-overview', getUsersOverview);
router.get('/revenue', getRevenueDashboard);
router.put('/accounts/:id', updateAccountMeta);
router.post('/accounts', addAccountForUser);
router.delete('/accounts/:id', deleteAccount);
router.put('/accounts/:id/reassign', reassignAccount);
router.post('/test-offline-alert', testOfflineAlert);
router.post('/sync-withdrawals', syncWithdrawals);
router.put('/users/:userId/commission', updateCommissionRate);
router.get('/invoice', generateInvoice);
router.post('/invoice/send', sendInvoiceEmail);

// Expert Advisors management
router.get('/eas', adminListEAs);
router.post('/eas', createEA);
router.put('/eas/:id', updateEA);
router.delete('/eas/:id', deleteEA);

module.exports = router;

router.get('/users-overview', getUsersOverview);
router.put('/accounts/:id', updateAccountMeta);
router.post('/accounts', addAccountForUser);
router.delete('/accounts/:id', deleteAccount);
router.put('/accounts/:id/reassign', reassignAccount);
router.post('/test-offline-alert', testOfflineAlert);
router.post('/sync-withdrawals', syncWithdrawals);
router.put('/users/:userId/commission', updateCommissionRate);
router.get('/invoice', generateInvoice);
router.post('/invoice/send', sendInvoiceEmail);

// Expert Advisors management
router.get('/eas', adminListEAs);
router.post('/eas', createEA);
router.put('/eas/:id', updateEA);
router.delete('/eas/:id', deleteEA);

module.exports = router;
