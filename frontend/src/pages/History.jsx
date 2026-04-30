import { useEffect, useState } from 'react';
import { positionsAPI, accountsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const typeColors = { BUY: 'text-brand-400', SELL: 'text-danger-400' };

export default function History() {
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ account_id: '', from_date: '', to_date: '', page: 1 });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    accountsAPI.getAll().then(({ data }) => setAccounts(data.accounts));
    loadHistory();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [filters.page]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params = { ...filters, limit: 50 };
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      const { data } = await positionsAPI.getHistory(params);
      setTrades(data.trades);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load trade history');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, page: 1 }));
    loadHistory();
  };

  const handleSyncHistory = async () => {
    if (!filters.account_id) {
      toast.error('Select an account to sync history');
      return;
    }
    setSyncing(true);
    try {
      const { data } = await positionsAPI.syncHistory(filters.account_id);
      toast.success(`Synced ${data.count} trades`);
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Trade History</h2>
          <p className="text-sm text-slate-400 mt-0.5">{pagination.total} closed trades</p>
        </div>
        <button onClick={handleSyncHistory} className="btn-secondary" disabled={syncing}>
          <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync History
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-44">
            <label className="block text-xs text-slate-400 mb-1">Account</label>
            <select
              className="input-field"
              value={filters.account_id}
              onChange={(e) => setFilters((f) => ({ ...f, account_id: e.target.value }))}
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name} ({a.login})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              className="input-field"
              value={filters.from_date}
              onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              className="input-field"
              value={filters.to_date}
              onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
            />
          </div>
          <button type="submit" className="btn-primary">
            <MagnifyingGlassIcon className="w-4 h-4" />
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                {['Ticket', 'Symbol', 'Type', 'Lots', 'Open Price', 'Close Price', 'Profit', 'Commission', 'Swap', 'Net', 'Close Time'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 11 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-700 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : trades.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-16 text-slate-500">No trades found</td></tr>
              ) : (
                trades.map((trade) => {
                  const net = (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
                  return (
                    <tr key={`${trade.ticket}-${trade.mt4_account_id}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{trade.ticket}</td>
                      <td className="px-4 py-3 font-semibold text-slate-100">{trade.symbol}</td>
                      <td className={`px-4 py-3 font-semibold text-xs ${typeColors[trade.type] || 'text-slate-300'}`}>{trade.type}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{trade.lots?.toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{trade.open_price?.toFixed(5)}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{trade.close_price?.toFixed(5)}</td>
                      <td className={`px-4 py-3 font-mono ${trade.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>{formatCurrency(trade.profit)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{formatCurrency(trade.commission)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{formatCurrency(trade.swap)}</td>
                      <td className={`px-4 py-3 font-mono font-semibold ${net >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>{formatCurrency(net)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(trade.close_time)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <span className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} trades)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                disabled={filters.page <= 1}
                className="btn-secondary px-3 py-1 text-xs disabled:opacity-30"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                disabled={filters.page >= pagination.totalPages}
                className="btn-secondary px-3 py-1 text-xs disabled:opacity-30"
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
