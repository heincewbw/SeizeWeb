const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getTickets, createTicket, getTicket, addMessage, updateTicketStatus } = require('../controllers/ticketController');

router.use(authenticateToken);

router.get('/', getTickets);
router.post('/', createTicket);
router.get('/:id', getTicket);
router.post('/:id/messages', addMessage);
router.put('/:id/status', requireAdmin, updateTicketStatus);

module.exports = router;
