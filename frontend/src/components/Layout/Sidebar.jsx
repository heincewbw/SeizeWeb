import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  CreditCardIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  ChartBarIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ArrowDownTrayIcon,
  ArrowUpCircleIcon,
  UsersIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ChartBarSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import useAuthStore from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
  { to: '/accounts', icon: CreditCardIcon, label: 'MT4 Accounts' },
  { to: '/positions', icon: ArrowsRightLeftIcon, label: 'Open Positions' },
  { to: '/history', icon: ClockIcon, label: 'Trade History' },
  { to: '/eas', icon: CpuChipIcon, label: 'EAs' },
  { to: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
  { to: '/withdrawals', icon: ArrowDownTrayIcon, label: 'Withdraw' },
  { to: '/deposits', icon: ArrowUpCircleIcon, label: 'Deposits' },
  { to: '/referral', icon: UserGroupIcon, label: 'Referral' },
  { to: '/support', icon: ChatBubbleLeftRightIcon, label: 'Support' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
];

export default function Sidebar({ desktopCollapsed, mobileOpen, onDesktopToggle, onMobileClose }) {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={clsx(
        'flex flex-col flex-shrink-0 bg-dark-950 border-r border-slate-800',
        'transition-all duration-300 overflow-hidden',
        // Mobile: fixed overlay drawer
        'fixed inset-y-0 left-0 z-30 w-60',
        // Desktop: in document flow, translate always 0
        'lg:relative lg:z-auto lg:translate-x-0',
        // Mobile: slide in/out
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        // Desktop width
        desktopCollapsed ? 'lg:w-16' : 'lg:w-60',
      )}
    >
      {/* Logo + toggle */}
      <div className="h-16 flex items-center border-b border-slate-800 px-3 flex-shrink-0">
        <div className={clsx('flex items-center gap-2.5 flex-1 overflow-hidden', desktopCollapsed && 'lg:justify-center lg:flex-none')}>
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17L7 13L11 15L15 9L21 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className={clsx('text-lg font-bold text-white tracking-tight whitespace-nowrap', desktopCollapsed && 'lg:hidden')}>
            AceCapital
          </span>
        </div>

        {/* Desktop toggle */}
        <button
          onClick={onDesktopToggle}
          className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors flex-shrink-0"
          title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {desktopCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
        </button>

        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="lg:hidden flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors flex-shrink-0"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* User Info */}
      <div className="border-b border-slate-800 overflow-hidden">
        <div className={clsx('flex items-center gap-3 px-4 py-4', desktopCollapsed && 'lg:justify-center lg:px-3')}>
          <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-semibold text-sm flex-shrink-0">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className={clsx('min-w-0', desktopCollapsed && 'lg:hidden')}>
            <p className="text-sm font-medium text-slate-100 truncate">{user?.full_name || 'Investor'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        <p className={clsx('px-2 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider', desktopCollapsed && 'lg:hidden')}>
          Menu
        </p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onMobileClose}
            title={desktopCollapsed ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                desktopCollapsed ? 'lg:justify-center lg:px-0 lg:py-2.5' : '',
                'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )
            }
          >
            <Icon className="flex-shrink-0" style={{ width: '18px', height: '18px' }} />
            <span className={clsx('whitespace-nowrap', desktopCollapsed && 'lg:hidden')}>{label}</span>
          </NavLink>
        ))}

        {/* Admin section */}
        {user?.role === 'admin' && (
          <>
            <p className={clsx('px-2 mt-4 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider', desktopCollapsed && 'lg:hidden')}>
              Admin
            </p>
            {desktopCollapsed && <div className="hidden lg:block my-2 border-t border-slate-800" />}
            <NavLink
              to="/admin/users"
              onClick={onMobileClose}
              title={desktopCollapsed ? 'Users Overview' : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                  desktopCollapsed ? 'lg:justify-center lg:px-0 lg:py-2.5' : '',
                  'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )
              }
            >
              <UsersIcon style={{ width: '18px', height: '18px' }} className="flex-shrink-0" />
              <span className={clsx('whitespace-nowrap', desktopCollapsed && 'lg:hidden')}>Users Overview</span>
            </NavLink>
            <NavLink
              to="/admin/eas"
              onClick={onMobileClose}
              title={desktopCollapsed ? 'Manage EAs' : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                  desktopCollapsed ? 'lg:justify-center lg:px-0 lg:py-2.5' : '',
                  'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )
              }
            >
              <CpuChipIcon style={{ width: '18px', height: '18px' }} className="flex-shrink-0" />
              <span className={clsx('whitespace-nowrap', desktopCollapsed && 'lg:hidden')}>Manage EAs</span>
            </NavLink>
            <NavLink
              to="/admin/revenue"
              onClick={onMobileClose}
              title={desktopCollapsed ? 'Revenue' : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                  desktopCollapsed ? 'lg:justify-center lg:px-0 lg:py-2.5' : '',
                  'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )
              }
            >
              <ChartBarSquareIcon style={{ width: '18px', height: '18px' }} className="flex-shrink-0" />
              <span className={clsx('whitespace-nowrap', desktopCollapsed && 'lg:hidden')}>Revenue</span>
            </NavLink>
            <NavLink
              to="/admin/withdrawals"
              onClick={onMobileClose}
              title={desktopCollapsed ? 'User Withdrawals' : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                  desktopCollapsed ? 'lg:justify-center lg:px-0 lg:py-2.5' : '',
                  'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )
              }
            >
              <BanknotesIcon style={{ width: '18px', height: '18px' }} className="flex-shrink-0" />
              <span className={clsx('whitespace-nowrap', desktopCollapsed && 'lg:hidden')}>User Withdrawals</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className={clsx('border-t border-slate-800 p-3', desktopCollapsed && 'lg:flex lg:justify-center')}>
        <button
          onClick={handleLogout}
          title={desktopCollapsed ? 'Logout' : undefined}
          className={clsx(
            'flex items-center rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 w-full',
            desktopCollapsed ? 'lg:w-auto lg:justify-center lg:p-2.5' : 'gap-3 px-3 py-2.5',
            !desktopCollapsed && 'gap-3 px-3 py-2.5',
          )}
        >
          <ArrowRightOnRectangleIcon style={{ width: '18px', height: '18px' }} className="flex-shrink-0" />
          <span className={clsx('whitespace-nowrap', desktopCollapsed && 'lg:hidden')}>Logout</span>
        </button>
      </div>
    </aside>
  );
}

