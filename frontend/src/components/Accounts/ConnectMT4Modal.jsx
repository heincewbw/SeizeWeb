import { useState } from 'react';
import { accountsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { XMarkIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

export default function ConnectMT4Modal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ login: '', password: '', server: '', account_name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await accountsAPI.connect(form);
      onSuccess(data.account);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to connect MT4 account';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-dark-800 border border-slate-700 rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Connect MT4 Account</h3>
            <p className="text-xs text-slate-400 mt-0.5">Enter your MetaTrader 4 credentials</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Info Banner */}
          <div className="flex gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <InformationCircleIcon className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300">
              Make sure the <strong>SeizeBridge EA</strong> is installed and running in MetaTrader 4 with AutoTrading enabled.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              MT4 Login (Account Number) <span className="text-danger-400">*</span>
            </label>
            <input
              type="number"
              className="input-field"
              placeholder="e.g. 12345678"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              MT4 Password <span className="text-danger-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="Your investor or master password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Server <span className="text-danger-400">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. BrokerName-Live, ICMarkets-Live02"
              value={form.server}
              onChange={(e) => setForm({ ...form, server: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Account Label <span className="text-slate-500 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Main Account, Prop Firm"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Connecting...
                </span>
              ) : 'Connect Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
