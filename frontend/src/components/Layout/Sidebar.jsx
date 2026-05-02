import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  CreditCardIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ArrowDownTrayIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import useAuthStore from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
  { to: '/accounts', icon: CreditCardIcon, label: 'MT4 Accounts' },
  { to: '/positions', icon: ArrowsRightLeftIcon, label: 'Open Positions' },
  { to: '/history', icon: ClockIcon, label: 'Trade History' },
  { to: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
  { to: '/withdrawals', icon: ArrowDownTrayIcon, label: 'Withdraw' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
];

export default function Sidebar() {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 flex-shrink-0 bg-dark-950 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17L7 13L11 15L15 9L21 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-white tracking-tight">SeizeWeb</span>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-semibold text-sm">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{user?.full_name || 'Investor'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-2 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Menu</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )
            }
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
            {label}
          </NavLink>
        ))}

        {/* Admin section */}
        {user?.role === 'admin' && (
          <>
            <p className="px-2 mt-4 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Admin</p>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )
              }
            >
              <UsersIcon style={{ width: '18px', height: '18px' }} className="flex-shrink-0" />
              Users Overview
            </NavLink>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
        >
          <ArrowRightOnRectangleIcon style={{ width: '18px', height: '18px' }} />
          Logout
        </button>
      </div>
    </aside>
  );
}
