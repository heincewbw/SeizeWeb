import { useState } from 'react';
import { authAPI } from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import toast from 'react-hot-toast';
import { UserIcon, LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function Settings() {
  const { user } = useAuthStore();
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authAPI.changePassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Settings</h2>
        <p className="text-sm text-slate-400 mt-0.5">Manage your account preferences</p>
      </div>

      {/* Profile Info */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <UserIcon className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-slate-200">Profile Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Full Name</label>
            <div className="input-field cursor-default opacity-70">{user?.full_name}</div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <div className="input-field cursor-default opacity-70">{user?.email}</div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Role</label>
            <div className="input-field cursor-default opacity-70 capitalize">{user?.role}</div>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-3">To update profile information, contact support.</p>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <LockClosedIcon className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-slate-200">Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Current Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={pwForm.current_password}
              onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">New Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Min. 8 chars with uppercase & number"
              value={pwForm.new_password}
              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Re-enter new password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              required
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Security Info */}
      <div className="card border-brand-500/20">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-slate-200 mb-1">Security Notice</h3>
            <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
              <li>MT4 passwords are never stored — only used to authenticate the bridge connection</li>
              <li>All data is transmitted over encrypted connections</li>
              <li>Sessions expire after 7 days</li>
              <li>Enable 2FA (coming soon) for additional security</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
