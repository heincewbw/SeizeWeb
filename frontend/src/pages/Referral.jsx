import { useEffect, useState } from 'react';
import { referralsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon, UserGroupIcon, GiftIcon } from '@heroicons/react/24/outline';
import { formatDate } from '@/utils/format';

export default function Referral() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await referralsAPI.get();
        setData(res);
      } catch {
        toast.error('Failed to load referral data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(data.referral_url);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(data.referral_code);
    toast.success('Code copied!');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Referral Program</h2>
        </div>
        <div className="card animate-pulse h-40 bg-slate-800/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Referral Program</h2>
        <p className="text-sm text-slate-400 mt-0.5">Invite friends to AceCapital and grow together</p>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center">
            <UserGroupIcon className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Referred</p>
            <p className="text-2xl font-bold text-slate-100">{data?.total_referrals || 0}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
            <GiftIcon className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Your Code</p>
            <p className="text-lg font-bold text-slate-100 font-mono tracking-widest">{data?.referral_code || '—'}</p>
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Your Referral Link</h3>
        <div className="flex gap-2">
          <div className="flex-1 input-field text-slate-400 text-sm truncate bg-slate-900 select-all cursor-text">
            {data?.referral_url}
          </div>
          <button
            onClick={handleCopyUrl}
            className="btn-secondary flex-shrink-0"
            title="Copy link"
          >
            {copied
              ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
              : <ClipboardDocumentIcon className="w-4 h-4" />
            }
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 input-field text-slate-400 text-sm bg-slate-900 font-mono tracking-widest">
            Code: {data?.referral_code}
          </div>
          <button onClick={handleCopyCode} className="btn-secondary flex-shrink-0">
            <ClipboardDocumentIcon className="w-4 h-4" />
            Copy Code
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Share your link or code. When someone registers using it, they'll be linked to your account.
        </p>
      </div>

      {/* Referred Users */}
      {data?.referred_users?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200">Referred Investors</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-semibold uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-semibold uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {data.referred_users.map((u, i) => (
                <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3 text-slate-300">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(u.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.referred_users?.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <UserGroupIcon className="w-10 h-10 mx-auto opacity-30 mb-3" />
          <p className="text-sm">No referrals yet. Share your link to get started!</p>
        </div>
      )}
    </div>
  );
}
