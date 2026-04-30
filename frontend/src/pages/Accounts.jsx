import { useEffect, useState } from 'react';
import { accountsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import AccountCard from '@/components/Accounts/AccountCard';
import ConnectMT4Modal from '@/components/Accounts/ConnectMT4Modal';
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const { data } = await accountsAPI.getAll();
      setAccounts(data.accounts);
    } catch {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (newAccount) => {
    setAccounts((prev) => {
      const exists = prev.find((a) => a.id === newAccount.id);
      return exists ? prev.map((a) => (a.id === newAccount.id ? newAccount : a)) : [newAccount, ...prev];
    });
    setShowModal(false);
    toast.success('MT4 account connected!');
  };

  const handleSync = async (id) => {
    setSyncing(id);
    try {
      const { data } = await accountsAPI.sync(id);
      setAccounts((prev) => prev.map((a) => (a.id === id ? data.account : a)));
      toast.success('Account synced');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (id) => {
    if (!confirm('Disconnect this MT4 account?')) return;
    try {
      await accountsAPI.disconnect(id);
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, is_connected: false } : a)));
      toast.success('Account disconnected');
    } catch {
      toast.error('Failed to disconnect account');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">MT4 Accounts</h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage your MetaTrader 4 connections</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          Connect Account
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-52 bg-dark-800" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-slate-600">
              <path d="M3 17L7 13L11 15L15 9L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No MT4 Accounts Connected</h3>
          <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">
            Connect your MetaTrader 4 account to start monitoring your trading performance.
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">
            <PlusIcon className="w-4 h-4" />
            Connect First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onSync={() => handleSync(account.id)}
              onDisconnect={() => handleDisconnect(account.id)}
              isSyncing={syncing === account.id}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ConnectMT4Modal
          onClose={() => setShowModal(false)}
          onSuccess={handleConnect}
        />
      )}
    </div>
  );
}
