import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useEffect } from 'react';
import { getSocket } from '@/services/socket';
import useDashboardStore from '@/store/useDashboardStore';

export default function Layout() {
  const { updateAccount, setPositions } = useDashboardStore();

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
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
