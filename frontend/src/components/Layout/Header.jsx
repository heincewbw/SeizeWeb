import { useLocation } from 'react-router-dom';
import { BellIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { getSocket } from '@/services/socket';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/accounts': 'MT4 Accounts',
  '/positions': 'Open Positions',
  '/history': 'Trade History',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

export default function Header({ onMobileMenuToggle }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'AceCapital';
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    setConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <header className="h-16 flex-shrink-0 bg-dark-950 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
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
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-brand-400 animate-pulse' : 'bg-slate-600'}`}
          />
          <span className={connected ? 'text-brand-400' : 'text-slate-500'}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        <button className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors">
          <BellIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
