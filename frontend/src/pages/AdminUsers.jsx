import { useEffect, useState } from 'react';
import { adminAPI } from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/format';
import { PencilIcon, CheckIcon, XMarkIcon, PlusIcon, KeyIcon, ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import AdminAddAccountModal from '@/components/Accounts/AdminAddAccountModal';

function DDCell({ value }) {
  const v = Number(value) || 0;
  const color = v <= 5 ? 'text-brand-400' : v <= 20 ? 'text-yellow-400' : 'text-danger-400';
  return <span className={clsx('font-mono', color)}>{v.toFixed(2)}%</span>;
}

function EditableCell({ value, onSave, prefix = '', type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');

  const handleSave = () => {
    onSave(val);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[100px]">
        <input
          autoFocus
          type={type}
          className="bg-slate-700 border border-slate-500 rounded px-2 py-0.5 text-xs text-slate-100 w-24"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={handleSave} className="text-brand-400 hover:text-brand-300"><CheckIcon className="w-3.5 h-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-slate-500 hover:text-slate-300"><XMarkIcon className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setVal(value ?? ''); setEditing(true); }}
      className="flex items-center gap-1 group text-slate-300 hover:text-slate-100"
    >
      <span>{prefix}{value !== undefined && value !== null && value !== '' ? value : <span className="text-slate-600 italic">—</span>}</span>
      <PencilIcon className="w-3 h-3 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
    </button>
  );
}

export default function AdminUsers() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [addModal, setAddModal] = useState(null); // user object or null
  const [tokenModal, setTokenModal] = useState(null); // { login, server, account_name }
  const [tokenValue, setTokenValue] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const handleShowToken = async (a) => {
    setTokenModal(a);
    setTokenValue(null);
    setTokenLoading(true);
    try {
      const { data } = await adminAPI.getToken(a.login, a.server);
      setTokenValue(data.bridge_token);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mengambil token');
      setTokenModal(null);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (!tokenValue) return;
    navigator.clipboard.writeText(tokenValue);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getUsersOverview();
      setUsers(data.users);
      // Auto-expand users that have accounts
      const exp = {};
      data.users.forEach((u) => { if (u.accounts.length > 0) exp[u.id] = true; });
      setExpanded(exp);
    } catch {
      toast.error('Gagal memuat data users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMeta = async (accountId, field, value) => {
    try {
      await adminAPI.updateAccountMeta(accountId, { [field]: value });
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          accounts: u.accounts.map((a) =>
            a.id === accountId ? { ...a, [field]: Number(value) } : a
          ),
        }))
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  };

  const toggleExpand = (userId) =>
    setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));

  const handleAccountAdded = (newAccount) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === newAccount.user_id
          ? {
              ...u,
              accounts: [
                ...u.accounts,
                {
                  id: newAccount.id,
                  login: newAccount.login,
                  server: newAccount.server,
                  account_name: newAccount.account_name,
                  currency: newAccount.currency,
                  initial_balance: Number(newAccount.initial_balance) || 0,
                  balance: 0,
                  equity: 0,
                  profit: 0,
                  dd: 0,
                  max_dd: 0,
                  is_connected: false,
                },
              ],
            }
          : u
      )
    );
    setExpanded((prev) => ({ ...prev, [newAccount.user_id]: true }));
  };

  // Aggregate totals across connected accounts only
  const totals = users.reduce(
    (acc, u) => {
      u.accounts.filter((a) => a.is_connected).forEach((a) => {
        acc.initialBalance += a.initial_balance || 0;
        acc.balance += a.balance || 0;
        acc.equity += a.equity || 0;
        acc.profit += a.profit || 0;
      });
      return acc;
    },
    { initialBalance: 0, balance: 0, equity: 0, profit: 0 }
  );

  return (
    <div className="space-y-6">
      {addModal && (
        <AdminAddAccountModal
          user={addModal}
          onClose={() => setAddModal(null)}
          onSuccess={handleAccountAdded}
        />
      )}
      {tokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-dark-800 border border-slate-700 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <KeyIcon className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-semibold text-slate-100">EA Bridge Token</h3>
              </div>
              <button onClick={() => setTokenModal(null)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-400">
                Akun <span className="font-mono text-brand-400">{tokenModal.login} @ {tokenModal.server}</span>
              </p>
              {tokenLoading ? (
                <div className="text-center py-4 text-slate-500 text-sm">Mengambil token...</div>
              ) : tokenValue ? (
                <>
                  <div className="bg-dark-900 rounded-lg p-3 border border-brand-500/30">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono text-slate-300 break-all">{tokenValue}</code>
                      <button onClick={handleCopyToken} className="btn-secondary px-2 py-1.5 flex-shrink-0">
                        {tokenCopied ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-brand-400" /> : <ClipboardIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>1. Pasang EA SeizeBridge ke chart MT4</p>
                    <p>2. Paste token di atas ke input <span className="font-mono bg-slate-800 px-1 rounded">BridgeToken</span></p>
                    <p>3. Atau isi <span className="font-mono bg-slate-800 px-1 rounded">EaSecret</span> untuk auto-fetch token</p>
                  </div>
                </>
              ) : null}
              <button onClick={() => setTokenModal(null)} className="btn-secondary w-full">Tutup</button>
            </div>
          </div>
        </div>
      )}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Users Overview</h2>
        <p className="text-sm text-slate-400 mt-0.5">Seluruh user dan performa akun MT4 mereka</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Modal Awal', value: formatCurrency(totals.initialBalance) },
          { label: 'Total Balance', value: formatCurrency(totals.balance) },
          { label: 'Total Equity', value: formatCurrency(totals.equity) },
          {
            label: 'Total Profit',
            value: formatCurrency(totals.profit),
            color: totals.profit >= 0 ? 'text-brand-400' : 'text-danger-400',
          },
        ].map((c) => (
          <div key={c.label} className="card">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className={clsx('text-xl font-bold font-mono mt-1', c.color || 'text-slate-100')}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="card text-center py-10 text-slate-500">Memuat...</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="card p-0 overflow-hidden">
              {/* User Header Row */}
              <button
                onClick={() => toggleExpand(u.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-semibold text-sm flex-shrink-0">
                    {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-100">{u.full_name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddModal(u); }}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 border border-brand-500/30 hover:border-brand-400/50 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Tambah Akun
                  </button>
                  <span className="text-xs text-slate-500">{u.accounts.length} akun</span>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full border',
                    u.is_active
                      ? 'bg-brand-500/15 text-brand-400 border-brand-500/20'
                      : 'bg-slate-700 text-slate-500 border-slate-600'
                  )}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <svg
                    className={clsx('w-4 h-4 text-slate-500 transition-transform', expanded[u.id] && 'rotate-180')}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Accounts Table */}
              {expanded[u.id] && u.accounts.length > 0 && (
                <div className="border-t border-slate-800 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/40">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Login</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Nama Akun</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Modal Awal</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Balance</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Equity</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">DD</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Max DD</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.accounts.map((a) => (
                        <tr key={a.id} className="border-t border-slate-800/50 transition-colors hover:bg-slate-800/20">
                          <td className="px-4 py-3">
                            <p className="font-mono text-slate-200 text-xs">{a.login}</p>
                            <p className="text-xs text-slate-500">{a.server}</p>
                            <button
                              onClick={() => handleShowToken(a)}
                              className="mt-1 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 border border-brand-500/30 hover:border-brand-400/50 rounded px-1.5 py-0.5 transition-colors"
                              title="Lihat EA Bridge Token"
                            >
                              <KeyIcon className="w-3 h-3" />
                              EA Token
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-300">{a.account_name || <span className="text-slate-600 italic">—</span>}</p>
                            {!a.is_connected && <span className="text-xs text-slate-600 italic">EA offline</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <EditableCell
                              value={a.initial_balance || ''}
                              type="number"
                              onSave={(v) => handleUpdateMeta(a.id, 'initial_balance', v)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-200">
                            {formatCurrency(a.balance, a.currency)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {formatCurrency(a.equity, a.currency)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DDCell value={a.dd} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DDCell value={a.max_dd} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            <span className={a.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}>
                              {a.profit >= 0 ? '+' : ''}{formatCurrency(a.profit, a.currency)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Per-user subtotal */}
                    {u.accounts.length > 1 && (() => {
                      const sub = u.accounts.reduce(
                        (s, a) => ({ ib: s.ib + (a.initial_balance || 0), bal: s.bal + a.balance, eq: s.eq + a.equity, pr: s.pr + a.profit }),
                        { ib: 0, bal: 0, eq: 0, pr: 0 }
                      );
                      return (
                        <tfoot>
                          <tr className="border-t border-slate-700 bg-slate-800/30">
                            <td colSpan={2} className="px-4 py-2 text-xs text-slate-500 font-semibold">Subtotal</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">{formatCurrency(sub.ib)}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">{formatCurrency(sub.bal)}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">{formatCurrency(sub.eq)}</td>
                            <td colSpan={2} />
                            <td className={clsx('px-4 py-2 text-right font-mono text-xs font-semibold', sub.pr >= 0 ? 'text-brand-400' : 'text-danger-400')}>
                              {sub.pr >= 0 ? '+' : ''}{formatCurrency(sub.pr)}
                            </td>
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                </div>
              )}

              {expanded[u.id] && u.accounts.length === 0 && (
                <div className="border-t border-slate-800 px-4 py-4 text-xs text-slate-600 italic">
                  Belum ada akun MT4 yang terhubung
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
