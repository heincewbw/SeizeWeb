import { useEffect, useState } from 'react';
import { depositsAPI, accountsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { ArrowUpCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function Deposits() {
  const [deposits, setDeposits] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filterAccount, setFilterAccount] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    accountsAPI.getAll().then(({ data }) => setAccounts(data.accounts || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load(1);
  }, [filterAccount]);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterAccount) params.account_id = filterAccount;
      const { data } = await depositsAPI.getAll(params);
      setDeposits(data.deposits);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load deposit history');
    } finally {
      setLoading(false);
    }
  };

  const totalDeposited = deposits.reduce((s, d) => s + (d.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Deposit History</h2>
          <p className="text-sm text-slate-400 mt-0.5">All capital deposits detected from your MT4 accounts</p>
        </div>
        {totalDeposited > 0 && (
          <div className="card py-3 px-5 flex items-center gap-3">
            <ArrowUpCircleIcon className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xs text-slate-400">Total Deposited</p>
              <p className="text-lg font-bold text-green-400">{formatCurrency(totalDeposited)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter */}
      {accounts.length > 1 && (
        <div className="flex gap-3">
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="input-field w-64"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name} ({a.login})</option>
            ))}
          </select>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Ticket</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Account</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Comment</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">Loading...</td></tr>
            ) : deposits.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500 text-sm">No deposits found</td></tr>
            ) : (
              deposits.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{d.ticket}</td>
                  <td className="px-4 py-3 text-slate-300">{d.mt4_accounts?.account_name || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-green-400">
                    +{formatCurrency(d.amount, d.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{d.comment || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {d.close_time ? formatDate(d.close_time) : formatDate(d.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {pagination.total} deposits total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => load(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-xs text-slate-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => load(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
