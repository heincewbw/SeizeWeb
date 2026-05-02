import { useEffect, useState } from 'react';
import { withdrawalsAPI } from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { XMarkIcon } from '@heroicons/react/24/outline';
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

export default function Withdrawals() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [withdrawals, setWithdrawals] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  // Admin status update modal
  const [statusModal, setStatusModal] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', admin_notes: '' });

  useEffect(() => {
    loadWithdrawals(1);
  }, [filterStatus, filterType]);

  const loadWithdrawals = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      const { data } = await withdrawalsAPI.getAll(params);
      setWithdrawals(data.withdrawals);
      setPagination(data.pagination);
    } catch {
      toast.error('Gagal memuat data withdraw');
    } finally {
      setLoading(false);
    }
  };

  const openStatusModal = (w) => {
    setStatusModal({ id: w.id, currentStatus: w.status });
    setStatusForm({ status: '', admin_notes: '' });
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    try {
      await withdrawalsAPI.updateStatus(statusModal.id, statusForm);
      toast.success('Status diperbarui');
      setStatusModal(null);
      loadWithdrawals(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal memperbarui status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Riwayat Withdrawal</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Withdrawal terdeteksi otomatis dari histori MT4 — {pagination.total} transaksi
        </p>
      </div>

      {/* Filter */}
      <div className="card">
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
                {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akun MT4</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ticket</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tipe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Jumlah</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Komentar</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Waktu</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 9 : 7} className="text-center py-10 text-slate-500">Memuat...</td></tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="text-center py-10 text-slate-500">
                    Belum ada withdrawal yang terdeteksi dari MT4
                  </td>
                </tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    {isAdmin && (
                      <td className="px-4 py-3 text-slate-300">
                        <p className="font-medium">{w.users?.full_name || '—'}</p>
                        <p className="text-xs text-slate-500">{w.users?.email}</p>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-300">
                      <p className="font-medium">{w.mt4_accounts?.account_name || '—'}</p>
                      <p className="text-xs text-slate-500">{w.mt4_accounts?.login} · {w.mt4_accounts?.server}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">{w.ticket}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium', TYPE_BADGE[w.type] || '')}>
                        {w.type === 'transfer' ? 'Transfer' : 'Withdrawal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-danger-400">
                      -{formatCurrency(w.amount, w.mt4_accounts?.currency || w.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[180px] truncate" title={w.comment}>
                      {w.comment || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {w.close_time ? formatDate(w.close_time) : formatDate(w.created_at)}
                    </td>
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
                    {isAdmin && (
                      <td className="px-4 py-3">
                        {w.status === 'detected' && (
                          <button
                            onClick={() => openStatusModal(w)}
                            className="btn-secondary text-xs py-1 px-2.5 whitespace-nowrap"
                          >
                            Update Status
                          </button>
                        )}
                      </td>
                    )}
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
              Halaman {pagination.page} dari {pagination.totalPages}
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

      {/* Admin: Update Status Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-dark-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-100">Update Status Withdrawal</h3>
              <button onClick={() => setStatusModal(null)} className="text-slate-500 hover:text-slate-200">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
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
                <label className="block text-sm text-slate-300 mb-1.5">Catatan Admin (opsional)</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Keterangan tambahan..."
                  value={statusForm.admin_notes}
                  onChange={(e) => setStatusForm({ ...statusForm, admin_notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary flex-1">Simpan</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setStatusModal(null)}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import useAuthStore from '@/store/useAuthStore';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const STATUS_BADGE = {
  pending:   'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  approved:  'bg-brand-500/15 text-brand-400 border border-brand-500/20',
  rejected:  'bg-danger-500/15 text-danger-400 border border-danger-500/20',
  processed: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
};

const EMPTY_FORM = {
  amount: '',
  currency: 'USD',
  mt4_account_id: '',
  bank_name: '',
  account_number: '',
  account_name: '',
  notes: '',
};

export default function Withdrawals() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [withdrawals, setWithdrawals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState('');

  // Admin: update status modal
  const [statusModal, setStatusModal] = useState(null); // { id, currentStatus }
  const [statusForm, setStatusForm] = useState({ status: '', admin_notes: '' });

  useEffect(() => {
    accountsAPI.getAll().then(({ data }) => setAccounts(data.accounts || []));
    loadWithdrawals(1);
  }, [filterStatus]);

  const loadWithdrawals = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      const { data } = await withdrawalsAPI.getAll(params);
      setWithdrawals(data.withdrawals);
      setPagination(data.pagination);
    } catch {
      toast.error('Gagal memuat data withdraw');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await withdrawalsAPI.create({
        ...form,
        amount: Number(form.amount),
        mt4_account_id: form.mt4_account_id || undefined,
      });
      toast.success('Permintaan withdraw berhasil dikirim');
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadWithdrawals(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mengirim permintaan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Batalkan permintaan withdraw ini?')) return;
    try {
      await withdrawalsAPI.cancel(id);
      toast.success('Permintaan dibatalkan');
      loadWithdrawals(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membatalkan');
    }
  };

  const openStatusModal = (w) => {
    setStatusModal({ id: w.id, currentStatus: w.status });
    setStatusForm({ status: '', admin_notes: '' });
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    try {
      await withdrawalsAPI.updateStatus(statusModal.id, statusForm);
      toast.success('Status diperbarui');
      setStatusModal(null);
      loadWithdrawals(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal memperbarui status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Withdraw</h2>
          <p className="text-sm text-slate-400 mt-0.5">{pagination.total} total permintaan</p>
        </div>
        {!isAdmin && (
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2">
            <ArrowDownTrayIcon className="w-4 h-4" />
            Request Withdraw
          </button>
        )}
      </div>

      {/* Request Form */}
      {showForm && (
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-4">Form Permintaan Withdraw</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Jumlah <span className="text-danger-400">*</span></label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input-field"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Currency</label>
                <select
                  className="input-field"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  <option value="USD">USD</option>
                  <option value="IDR">IDR</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">MT4 Account (opsional)</label>
                <select
                  className="input-field"
                  value={form.mt4_account_id}
                  onChange={(e) => setForm({ ...form, mt4_account_id: e.target.value })}
                >
                  <option value="">— Tidak dipilih —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.account_name} ({a.login})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Nama Bank <span className="text-danger-400">*</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="BCA / BNI / ..."
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Nomor Rekening <span className="text-danger-400">*</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="1234567890"
                  value={form.account_number}
                  onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Nama Pemilik Rekening <span className="text-danger-400">*</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nama sesuai rekening"
                  value={form.account_name}
                  onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Catatan (opsional)</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="Informasi tambahan..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Mengirim...' : 'Kirim Permintaan'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="card">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-slate-400">Filter status:</span>
          {['', 'pending', 'approved', 'rejected', 'processed'].map((s) => (
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

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Jumlah</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Bank</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">No. Rekening</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-slate-500">Memuat...</td></tr>
              ) : withdrawals.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-slate-500">Belum ada permintaan withdraw</td></tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    {isAdmin && (
                      <td className="px-4 py-3 text-slate-300">
                        <p className="font-medium">{w.users?.full_name || '—'}</p>
                        <p className="text-xs text-slate-500">{w.users?.email}</p>
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono font-semibold text-slate-100">
                      {formatCurrency(w.amount, w.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{w.bank_name}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <p>{w.account_number}</p>
                      <p className="text-xs text-slate-500">{w.account_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium', STATUS_BADGE[w.status] || '')}>
                        {w.status}
                      </span>
                      {w.admin_notes && (
                        <p className="text-xs text-slate-500 mt-0.5 max-w-[160px] truncate" title={w.admin_notes}>{w.admin_notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(w.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {isAdmin && w.status !== 'processed' && (
                          <button
                            onClick={() => openStatusModal(w)}
                            className="btn-secondary text-xs py-1 px-2.5"
                          >
                            Update Status
                          </button>
                        )}
                        {!isAdmin && w.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(w.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                            title="Batalkan"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
              Halaman {pagination.page} dari {pagination.totalPages}
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

      {/* Admin: Update Status Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-dark-900 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-100">Update Status Withdrawal</h3>
              <button onClick={() => setStatusModal(null)} className="text-slate-500 hover:text-slate-200">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
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
                  {['approved', 'rejected', 'processed']
                    .filter((s) => s !== statusModal.currentStatus)
                    .map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Catatan Admin (opsional)</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Alasan penolakan, nomor referensi transfer, dll."
                  value={statusForm.admin_notes}
                  onChange={(e) => setStatusForm({ ...statusForm, admin_notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary flex-1">Simpan</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setStatusModal(null)}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
