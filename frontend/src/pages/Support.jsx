import { useEffect, useState } from 'react';
import { ticketsAPI } from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import toast from 'react-hot-toast';
import { formatDate } from '@/utils/format';
import { formatDistanceToNow } from 'date-fns';
import { PlusIcon, ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const STATUS_BADGE = {
  open:        'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  in_progress: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  resolved:    'bg-green-500/15 text-green-400 border border-green-500/20',
  closed:      'bg-slate-500/15 text-slate-400 border border-slate-700',
};

const PRIORITY_BADGE = {
  low:    'text-slate-400',
  normal: 'text-brand-400',
  high:   'text-amber-400',
  urgent: 'text-red-400',
};

export default function Support() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [view, setView] = useState('list'); // 'list' | 'new' | 'detail'
  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  // New ticket form
  const [form, setForm] = useState({ subject: '', message: '', priority: 'normal' });
  const [submitting, setSubmitting] = useState(false);

  // Ticket detail
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (view === 'list') loadTickets(1);
  }, [view, filterStatus]);

  const loadTickets = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      const { data } = await ticketsAPI.getAll(params);
      setTickets(data.tickets);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.message) return;
    setSubmitting(true);
    try {
      await ticketsAPI.create(form);
      toast.success('Ticket submitted successfully');
      setForm({ subject: '', message: '', priority: 'normal' });
      setView('list');
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const openTicket = async (ticket) => {
    setActiveTicket(ticket);
    setView('detail');
    setDetailLoading(true);
    try {
      const { data } = await ticketsAPI.get(ticket.id);
      setActiveTicket(data.ticket);
      setMessages(data.messages);
    } catch {
      toast.error('Failed to load ticket');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const { data } = await ticketsAPI.addMessage(activeTicket.id, reply);
      setMessages((prev) => [...prev, data.message]);
      setReply('');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await ticketsAPI.updateStatus(activeTicket.id, status);
      setActiveTicket((prev) => ({ ...prev, status }));
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  // ─── List View ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Support</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {isAdmin ? 'All support tickets from investors' : 'Submit and track your support requests'}
            </p>
          </div>
          {!isAdmin && (
            <button onClick={() => setView('new')} className="btn-primary">
              <PlusIcon className="w-4 h-4" />
              New Ticket
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                filterStatus === s
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                  : 'text-slate-400 hover:bg-slate-800'
              )}
            >
              {s === '' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No tickets found.{!isAdmin && ' Click "New Ticket" to open one.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  {isAdmin && <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">User</th>}
                  <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Subject</th>
                  <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Last Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTicket(t)}
                    className="hover:bg-slate-800/20 transition-colors cursor-pointer"
                  >
                    {isAdmin && (
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        <p className="font-medium">{t.users?.full_name}</p>
                        <p className="text-slate-500">{t.users?.email}</p>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-200 font-medium">{t.subject}</td>
                    <td className="px-4 py-3 text-xs font-semibold capitalize">
                      <span className={PRIORITY_BADGE[t.priority] || ''}>{t.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-md capitalize', STATUS_BADGE[t.status] || '')}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ─── New Ticket View ───────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">New Support Ticket</h2>
            <p className="text-sm text-slate-400 mt-0.5">Describe your issue and we'll get back to you</p>
          </div>
        </div>
        <div className="card">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                className="input-field"
                placeholder="Brief description of your issue"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Priority</label>
              <select
                className="input-field w-40"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Message</label>
              <textarea
                className="input-field min-h-32 resize-y"
                placeholder="Describe your issue in detail..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
                rows={5}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
              <button type="button" onClick={() => setView('list')} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── Detail View ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <button onClick={() => setView('list')} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors mt-0.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 truncate">{activeTicket?.subject}</h2>
            <span className={clsx('text-xs px-2 py-0.5 rounded-md capitalize flex-shrink-0', STATUS_BADGE[activeTicket?.status] || '')}>
              {activeTicket?.status?.replace('_', ' ')}
            </span>
          </div>
          {isAdmin && activeTicket?.users && (
            <p className="text-sm text-slate-400 mt-0.5">From: {activeTicket.users.full_name} ({activeTicket.users.email})</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">Opened {formatDate(activeTicket?.created_at)}</p>
        </div>
        {isAdmin && (
          <select
            value={activeTicket?.status || ''}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="input-field w-auto text-xs"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        )}
      </div>

      {/* Messages */}
      <div className="card p-0 overflow-hidden">
        {detailLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading...</div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {messages.map((m) => (
              <div key={m.id} className={clsx('px-5 py-4', m.is_admin ? 'bg-brand-500/5' : '')}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx('text-xs font-semibold', m.is_admin ? 'text-brand-400' : 'text-slate-300')}>
                    {m.is_admin ? '🛡 Support Team' : (m.users?.full_name || 'You')}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{m.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply box */}
      {activeTicket?.status !== 'closed' && (
        <form onSubmit={handleReply} className="card space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            {isAdmin ? 'Reply to investor' : 'Reply to support'}
          </label>
          <textarea
            className="input-field min-h-24 resize-y"
            placeholder="Type your message..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            required
            rows={3}
          />
          <button type="submit" disabled={sending} className="btn-primary">
            <PaperAirplaneIcon className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Reply'}
          </button>
        </form>
      )}
    </div>
  );
}
