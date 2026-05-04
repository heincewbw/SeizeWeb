import { useState } from 'react';
import { adminAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { XMarkIcon, PlusCircleIcon } from '@heroicons/react/24/outline';

export default function AdminAddAccountModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    login: '',
    server: '',
    account_name: '',
    currency: 'USD',
    initial_balance: '',
    nama_provider: '',
    ip_vps: '',
    email_vps: '',
    email_exness: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await adminAPI.addAccount({
        user_id: user.id,
        login: form.login,
        server: form.server,
        account_name: form.account_name || undefined,
        currency: form.currency,
        initial_balance: form.initial_balance !== '' ? Number(form.initial_balance) : 0,
        nama_provider: form.nama_provider,
        ip_vps: form.ip_vps,
        email_vps: form.email_vps,
        email_exness: form.email_exness,
      });
      toast.success(`Akun ${form.login} berhasil ditambahkan ke ${user.full_name}`);
      onSuccess(data.account);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menambahkan akun');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-dark-800 border border-slate-700 rounded-2xl shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <PlusCircleIcon className="w-5 h-5 text-brand-400" />
              <h3 className="text-lg font-semibold text-slate-100">Tambah Akun MT4</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Untuk investor: <span className="text-brand-400 font-medium">{user.full_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              MT4 Login (Account Number) <span className="text-danger-400">*</span>
            </label>
            <input
              type="number"
              className="input-field"
              placeholder="e.g. 87200828"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Server <span className="text-danger-400">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Exness-Real30"
              value={form.server}
              onChange={(e) => setForm({ ...form, server: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nama Akun <span className="text-slate-500 text-xs">(opsional)</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Seize HMM 4A"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Currency</label>
              <select
                className="input-field"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="USC">USC (cents)</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Modal Awal <span className="text-slate-500 text-xs">(opsional)</span>
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="e.g. 1000"
                min="0"
                step="any"
                value={form.initial_balance}
                onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
              />
            </div>
          </div>

          {form.currency === 'USC' && (
            <p className="text-xs text-amber-400/80 -mt-1">
              USC: masukkan Modal Awal dalam <strong>USD</strong> (misal: 1000 untuk $1,000). Nilai disimpan sebagai cents otomatis.
            </p>
          )}

          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Info VPS & Provider</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nama Provider <span className="text-danger-400">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Forexchief VPS"
                  value={form.nama_provider}
                  onChange={(e) => setForm({ ...form, nama_provider: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  IP VPS <span className="text-danger-400">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 192.168.1.100"
                  value={form.ip_vps}
                  onChange={(e) => setForm({ ...form, ip_vps: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email VPS <span className="text-danger-400">*</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="e.g. vps@gmail.com"
                  value={form.email_vps}
                  onChange={(e) => setForm({ ...form, email_vps: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email Exness <span className="text-danger-400">*</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="e.g. trader@exness.com"
                  value={form.email_exness}
                  onChange={(e) => setForm({ ...form, email_exness: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Batal
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Tambah Akun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
