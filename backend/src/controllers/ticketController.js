const supabase = require('../config/supabase');
const logger = require('../config/logger');
const { createNotification } = require('../services/notificationService');

// GET /api/tickets
const getTickets = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabase
      .from('support_tickets')
      .select(
        `id, subject, status, priority, created_at, updated_at,
         users(full_name, email)`,
        { count: 'exact' }
      )
      .order('updated_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (req.user.role !== 'admin') query = query.eq('user_id', req.user.id);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({
      tickets: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (err) {
    logger.error('getTickets error:', err);
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// POST /api/tickets
const createTicket = async (req, res) => {
  const { subject, message, priority = 'normal' } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ error: 'subject and message are required' });
  }

  try {
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({ user_id: req.user.id, subject, priority })
      .select()
      .single();
    if (error) throw error;

    await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      user_id: req.user.id,
      message,
      is_admin: false,
    });

    // Notify admins
    const io = req.app.get('io');
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    for (const admin of admins || []) {
      await createNotification(admin.id, {
        type: 'ticket_new',
        title: 'New Support Ticket',
        message: `${req.user.full_name} opened: "${subject}"`,
        data: { ticket_id: ticket.id },
      }, io);
    }

    return res.status(201).json({ ticket });
  } catch (err) {
    logger.error('createTicket error:', err);
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
};

// GET /api/tickets/:id
const getTicket = async (req, res) => {
  try {
    let q = supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, updated_at, users(full_name, email)')
      .eq('id', req.params.id);

    if (req.user.role !== 'admin') q = q.eq('user_id', req.user.id);

    const { data: ticket, error } = await q.single();
    if (error || !ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { data: messages } = await supabase
      .from('ticket_messages')
      .select('id, message, is_admin, created_at, users(full_name)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });

    return res.json({ ticket, messages: messages || [] });
  } catch (err) {
    logger.error('getTicket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/tickets/:id/messages
const addMessage = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    let q = supabase.from('support_tickets').select('id, user_id, subject, status').eq('id', req.params.id);
    if (req.user.role !== 'admin') q = q.eq('user_id', req.user.id);
    const { data: ticket, error: tErr } = await q.single();
    if (tErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });

    const isAdmin = req.user.role === 'admin';
    const { data: msg, error } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: ticket.id, user_id: req.user.id, message, is_admin: isAdmin })
      .select()
      .single();
    if (error) throw error;

    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticket.id);

    const io = req.app.get('io');
    if (isAdmin) {
      await createNotification(ticket.user_id, {
        type: 'ticket_reply',
        title: 'Support Reply',
        message: `Admin replied to: "${ticket.subject}"`,
        data: { ticket_id: ticket.id },
      }, io);
    } else {
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      for (const admin of admins || []) {
        await createNotification(admin.id, {
          type: 'ticket_reply',
          title: 'Ticket Reply',
          message: `${req.user.full_name} replied to: "${ticket.subject}"`,
          data: { ticket_id: ticket.id },
        }, io);
      }
    }

    return res.status(201).json({ message: msg });
  } catch (err) {
    logger.error('addMessage error:', err);
    return res.status(500).json({ error: 'Failed to add message' });
  }
};

// PUT /api/tickets/:id/status (admin only)
const updateTicketStatus = async (req, res) => {
  const { status } = req.body;
  const allowed = ['open', 'in_progress', 'resolved', 'closed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, user_id, subject')
      .single();

    if (error || !ticket) return res.status(404).json({ error: 'Ticket not found' });

    const io = req.app.get('io');
    await createNotification(ticket.user_id, {
      type: 'ticket_status',
      title: 'Ticket Updated',
      message: `Your ticket "${ticket.subject}" is now ${status.replace('_', ' ')}`,
      data: { ticket_id: ticket.id, status },
    }, io);

    return res.json({ ticket });
  } catch (err) {
    logger.error('updateTicketStatus error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getTickets, createTicket, getTicket, addMessage, updateTicketStatus };
