import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from '@/components/Layout/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Accounts from '@/pages/Accounts';
import Positions from '@/pages/Positions';
import History from '@/pages/History';
import EAs from '@/pages/EAs';
import Analytics from '@/pages/Analytics';
import Settings from '@/pages/Settings';
import Withdrawals from '@/pages/Withdrawals';
import Deposits from '@/pages/Deposits';
import Referral from '@/pages/Referral';
import Support from '@/pages/Support';
import AdminUsers from '@/pages/AdminUsers';
import AdminEAs from '@/pages/AdminEAs';
import AdminRevenue from '@/pages/AdminRevenue';
import AdminWithdrawals from '@/pages/AdminWithdrawals';
import EAsPublic from '@/pages/EAsPublic';
import useAuthStore from '@/store/useAuthStore';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="spinner" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/expert-advisors" element={<EAsPublic />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="positions" element={<Positions />} />
        <Route path="history" element={<History />} />
        <Route path="eas" element={<EAs />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="withdrawals" element={<Withdrawals />} />
        <Route path="deposits" element={<Deposits />} />
        <Route path="referral" element={<Referral />} />
        <Route path="support" element={<Support />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/eas" element={<AdminEAs />} />
        <Route path="admin/revenue" element={<AdminRevenue />} />
        <Route path="admin/withdrawals" element={<AdminWithdrawals />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
