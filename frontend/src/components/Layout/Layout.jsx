import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useEffect, useState } from 'react';
import { getSocket } from '@/services/socket';
import useDashboardStore from '@/store/useDashboardStore';

export default function Layout() {
  const { updateAccount, setPositions } = useDashboardStore();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('account_update', (data) => {
      updateAccount(data);
    });

    socket.on('positions_update', ({ positions }) => {
      setPositions(positions);
    });

    return () => {
      socket.off('account_update');
      socket.off('positions_update');
    };
  }, [updateAccount, setPositions]);

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        desktopCollapsed={desktopCollapsed}
        mobileOpen={mobileOpen}
        onDesktopToggle={() => setDesktopCollapsed((v) => !v)}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMobileMenuToggle={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
