import { useLocation, useNavigate } from 'react-router-dom';
import { BellIcon, Bars3Icon, CheckIcon, TrashIcon, BellSlashIcon } from '@heroicons/react/24/outline';
import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/services/socket';
import { notificationsAPI } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/accounts': 'MT4 Accounts',
  '/positions': 'Open Positions',
  '/history': 'Trade History',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/deposits': 'Deposit History',
  '/withdrawals': 'Withdrawals',
  '/referral': 'Referral',
  '/support': 'Support',
  '/eas': 'Expert Advisors',
  '/admin/revenue': 'Revenue Dashboard',
  '/admin/users': 'Users Overview',
  '/admin/eas': 'Manage EAs',
};

const NOTIFICATION_ICONS = {
  withdrawal_update: '💸',
  ticket_new: '🎫',
  ticket_reply: '💬',
  ticket_status: '✅',
  equity_alert: '⚠️',
  account_offline: '🔴',
  referral_joined: '🎉',
};

export default function Header({ onMobileMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] || 'AceCapital';
  const [connected, setConnected] = useState(false);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const loadNotifications = async () => {
    try {
      const { data } = await notificationsAPI.getAll({ limit: 10 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNotification = (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 10));
      setUnreadCount((c) => c + 1);
    };

    setConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification', onNotification);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification', onNotification);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleClickNotification = async (n) => {
    if (!n.is_read) {
      await notificationsAPI.markOneRead(n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    const link = ['ticket_new', 'ticket_reply', 'ticket_status'].includes(n.type)
      ? '/support'
      : n.type === 'withdrawal_update' ? '/withdrawals'
      : n.type === 'referral_joined' ? '/referral'
      : '/accounts';
    setOpen(false);
    navigate(link);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await notificationsAPI.delete(id);
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id);
      if (removed && !removed.is_read) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n.id !== id);
    });
  };

  return (
    <header className="h-16 flex-shrink-0 bg-dark-950 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className={connected ? 'text-brand-400' : 'text-slate-500'}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => { setOpen((v) => !v); if (!open) loadNotifications(); }}
            className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            aria-label="Notifications"
          >
            <BellIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-dark-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-100">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                    <CheckIcon className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
                    <BellSlashIcon className="w-8 h-8 opacity-40" />
                    <p className="text-xs">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleClickNotification(n)}
                      className={clsx(
                        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group',
                        n.is_read ? 'hover:bg-slate-800/40' : 'bg-brand-500/5 hover:bg-brand-500/10'
                      )}
                    >
                      <span className="text-base flex-shrink-0 mt-0.5">{NOTIFICATION_ICONS[n.type] || '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={clsx('text-xs font-semibold truncate', n.is_read ? 'text-slate-300' : 'text-slate-100')}>{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-600 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, n.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                      {!n.is_read && <span className="w-2 h-2 bg-brand-400 rounded-full flex-shrink-0 mt-1.5" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
