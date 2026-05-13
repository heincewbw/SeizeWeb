import { useEffect, useState } from 'react';
import { withdrawalsAPI } from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const STATUS_BADGE = {
  detected: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  verified: 'bg-brand-500/15 text-brand-400 border border-brand-500/20',
  rejected: 'bg-danger-500/15 text-danger-400 border border-danger-500/20',
};

const TYPE_BADGE = {
  withdrawal: 'bg-danger-500/15 text-danger-400 border border-danger-500/20',
  transfer:   'bg-blue-500/15 text-blue-400 border border-blue-500/20',
};

export default function AdminWithdrawals() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [withdrawals, setWithdrawals] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin status update modal
  const [statusModal, setStatusModal] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', admin_notes: '' });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    loadWithdrawals(1);
  }, [filterStatus, filterType]);

  const loadWithdrawals = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      const { data } = await withdrawalsAPI.getAll(params);
      setWithdrawals(data.withdrawals);
      setPagination(data.pagination);
    } catch {
      toast.error('Gagal memuat data withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const openStatusModal = (w) => {
    setStatusModal({ id: w.id, currentStatus: w.status, amount: w.amount, currency: w.mt4_accounts?.currency || w.currency });
    setStatusForm({ status: '', admin_notes: '' });
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await withdrawalsAPI.updateStatus(statusModal.id, statusForm);
      toast.success('Status withdrawal diperbarui');
      setStatusModal(null);
      loadWithdrawals(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal memperbarui status');
    } finally {
      setUpdating(false);
    }
  };

  // Client-side search filter by name / email / ticket / account
  const filtered = searchQuery.trim()
    ? withdrawals.filter((w) => {
        const q = searchQuery.toLowerCase();
        return (
          w.users?.full_name?.toLowerCase().includes(q) ||
          w.users?.email?.toLowerCase().includes(q) ||
          String(w.ticket ?? '').includes(q) ||
          w.mt4_accounts?.account_name?.toLowerCase().includes(q) ||
          String(w.mt4_accounts?.login ?? '').includes(q)
        );
      })
    : withdrawals;

  // Summary counts from current page
  const totalVerified = filtered.filter((w) => w.status === 'verified').reduce((s, w) => s + Number(w.amount), 0);
  const totalDetected = filtered.filter((w) => w.status === 'detected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Admin — Riwayat Withdrawal</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Semua withdrawal user terdeteksi dari histori MT4 &mdash; {pagination.total} transaksi
          </p>
        </div>
        {totalDetected > 0 && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-xs font-medium text-yellow-400">{totalDetected} perlu verifikasi</span>
          </div>
        )}
      </div>

      {/* Filters + Search */}
      <div className="card space-y-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama, email, ticket, atau akun MT4..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>

        {/* Type & Status chips */}
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-400">Tipe:</span>
            {['', 'withdrawal', 'transfer'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                  filterType === t
                    ? 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                    : 'text-slate-400 border-slate-700 hover:border-slate-500'
                )}
              >
                {t === '' ? 'Semua' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-400">Status:</span>
            {['', 'detected', 'verified', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                  filterStatus === s
                    ? 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                    : 'text-slate-400 border-slate-700 hover:border-slate-500'
                )}
              >
                {s === '' ? 'Semua' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akun MT4</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ticket</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tipe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Jumlah</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Waktu</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Komentar</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">Memuat data...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    {searchQuery ? 'Tidak ada hasil untuk pencarian ini' : 'Belum ada withdrawal yang terdeteksi'}
                  </td>
                </tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    {/* User */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200">{w.users?.full_name || '—'}</p>
                      <p className="text-xs text-slate-500">{w.users?.email}</p>
                    </td>
                    {/* MT4 Account */}
                    <td className="px-4 py-3 text-slate-300">
                      <p className="font-medium">{w.mt4_accounts?.account_name || '—'}</p>
                      <p className="text-xs text-slate-500">{w.mt4_accounts?.login} · {w.mt4_accounts?.server}</p>
                    </td>
                    {/* Ticket */}
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">{w.ticket ?? '—'}</td>
                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium', TYPE_BADGE[w.type] || TYPE_BADGE.withdrawal)}>
                        {w.type === 'transfer' ? 'Transfer' : 'Withdrawal'}
                      </span>
                    </td>
                    {/* Amount */}
                    <td className="px-4 py-3 font-mono font-semibold text-danger-400 whitespace-nowrap">
                      -{formatCurrency(w.amount, w.mt4_accounts?.currency || w.currency)}
                    </td>
                    {/* Time */}
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {formatDate(w.close_time || w.created_at)}
                    </td>
                    {/* Comment */}
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px]">
                      <span className="truncate block" title={w.comment}>{w.comment || '—'}</span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium', STATUS_BADGE[w.status] || '')}>
                        {w.status}
                      </span>
                      {w.admin_notes && (
                        <p className="text-xs text-slate-500 mt-0.5 max-w-[140px] truncate" title={w.admin_notes}>
                          {w.admin_notes}
                        </p>
                      )}
                    </td>
                    {/* Action */}
                    <td className="px-4 py-3">
                      {w.status === 'detected' && (
                        <button
                          onClick={() => openStatusModal(w)}
                          className="btn-secondary text-xs py-1 px-2.5 whitespace-nowrap"
                        >
                          Verifikasi
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <span className="text-xs text-slate-500">
              Halaman {pagination.page} dari {pagination.totalPages} &mdash; {pagination.total} total
            </span>
            <div className="flex gap-2">
              <button
                className="btn-secondary text-xs py-1 px-3"
                disabled={pagination.page <= 1}
                onClick={() => loadWithdrawals(pagination.page - 1)}
              >
                Prev
              </button>
              <button
                className="btn-secondary text-xs py-1 px-3"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadWithdrawals(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Update Status Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-dark-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-100">Verifikasi Withdrawal</h3>
              <button onClick={() => setStatusModal(null)} className="text-slate-500 hover:text-slate-200">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Jumlah:{' '}
              <span className="font-semibold text-danger-400">
                -{formatCurrency(statusModal.amount, statusModal.currency)}
              </span>
            </p>
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Status Baru</label>
                <select
                  className="input-field"
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  required
                >
                  <option value="">— Pilih status —</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Catatan Admin <span className="text-slate-500">(opsional)</span></label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Catatan untuk investor..."
                  value={statusForm.admin_notes}
                  onChange={(e) => setStatusForm({ ...statusForm, admin_notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStatusModal(null)} className="btn-secondary flex-1">
                  Batal
                </button>
                <button type="submit" disabled={!statusForm.status || updating} className="btn-primary flex-1">
                  {updating ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
