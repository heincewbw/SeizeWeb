import { useEffect, useMemo, useState } from 'react';
import { positionsAPI, accountsAPI } from '@/services/api';
import useDashboardStore from '@/store/useDashboardStore';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/format';
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function History() {
  // dailyRows from server — already aggregated, no client-side grouping needed
  const [dailyRows, setDailyRows] = useState([]);
  // Read accounts from Zustand store (populated by Dashboard) — fetch only if empty
  const { accounts, setAccounts } = useDashboardStore();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ account_id: '', from_date: '', to_date: '' });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (accounts.length === 0) {
      accountsAPI.getAll().then(({ data }) => setAccounts(data.accounts)).catch(() => {});
    }
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      // getDailyHistory: backend aggregates by day — tiny response instead of 5000 raw rows
      const { data } = await positionsAPI.getDailyHistory(params);
      setDailyRows(data.daily || []);
    } catch {
      toast.error('Failed to load trade history');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
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

  // Single pass over dailyRows to compute totals — no second useMemo needed
  const totals = useMemo(() => {
    return dailyRows.reduce(
      (acc, r) => {
        acc.trades += r.trades;
        acc.wins += r.wins;
        acc.losses += r.losses;
        acc.lots += r.lots;
        acc.profit += r.profit;
        acc.net += r.net;
        return acc;
      },
      { trades: 0, wins: 0, losses: 0, lots: 0, profit: 0, net: 0 }
    );
  }, [dailyRows]);

  const formatDayLabel = (key) => {
    try {
      return new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return key;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Trade History</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading
              ? 'Loading...'
              : `${dailyRows.length} trading day${dailyRows.length !== 1 ? 's' : ''} — ${totals.trades} trades`}
          </p>
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
                {['Date', 'Trades', 'Win / Loss', 'Total Lots', 'Profit', 'Net P/L'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-700 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : dailyRows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-slate-500">No trades found</td></tr>
              ) : (
                dailyRows.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-100 whitespace-nowrap">{formatDayLabel(row.date)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{row.trades}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className="text-brand-400 font-semibold">{row.wins}</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-danger-400 font-semibold">{row.losses}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{row.lots.toFixed(2)}</td>
                    <td className={`px-4 py-3 font-mono ${row.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                      {formatCurrency(row.profit)}
                    </td>
                    <td className={`px-4 py-3 font-mono font-semibold ${row.net >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                      {formatCurrency(row.net)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && dailyRows.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-800/30">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-400">Total</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-200">{totals.trades}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className="text-brand-400 font-semibold">{totals.wins}</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-danger-400 font-semibold">{totals.losses}</span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-200">{totals.lots.toFixed(2)}</td>
                  <td className={`px-4 py-3 font-mono font-bold ${totals.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                    {formatCurrency(totals.profit)}
                  </td>
                  <td className={`px-4 py-3 font-mono font-bold ${totals.net >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                    {formatCurrency(totals.net)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
