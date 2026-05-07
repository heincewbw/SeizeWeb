import { useEffect, useState } from 'react';
import { easAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ArrowRightOnRectangleIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

function formatDateLabel(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

export default function EAsPublic() {
  const [eas, setEas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await easAPI.list();
        setEas(data.eas || []);
      } catch {
        toast.error('Failed to load EAs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-dark-950 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17L7 13L11 15L15 9L21 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">AceCapital</span>
          </div>
          <Link
            to="/login"
            className="btn-primary text-sm"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Login
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Expert Advisors</h2>
          <p className="text-slate-400 mt-1.5">
            Browse available EAs and review their live performance before investing.
          </p>
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading...</div>
        ) : eas.length === 0 ? (
          <div className="card text-slate-500 text-sm text-center py-10">No EAs available yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {eas.map((ea) => (
              <div key={ea.id} className="card flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center">
                      <CpuChipIcon className="w-6 h-6 text-brand-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{ea.name}</h3>
                      {ea.tagline && <p className="text-xs text-slate-500">{ea.tagline}</p>}
                    </div>
                  </div>
                  {ea.status && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20 whitespace-nowrap">
                      {ea.status}
                    </span>
                  )}
                </div>

                {ea.description && (
                  <p className="text-sm text-slate-400 mt-4 leading-relaxed">{ea.description}</p>
                )}

                {ea.tags && ea.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {ea.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {ea.widget_url && (
                  <div className="mt-5 rounded-lg border border-slate-800 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/40">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                        Live Performance
                      </span>
                      <span className="text-[10px] text-slate-500">via Myfxbook</span>
                    </div>
                    <a
                      href={ea.widget_link || ea.myfxbook_url || ea.widget_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden"
                    >
                    <img
                        src={ea.widget_url}
                        alt={`${ea.name} live performance widget`}
                        className="w-full h-auto block"
                        style={{ marginTop: '-38px' }}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <CalendarDaysIcon className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <span className="truncate">Started {formatDateLabel(ea.tracking_start)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <ShieldCheckIcon className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    Verified
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <ChartBarIcon className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    Live Myfxbook
                  </div>
                  {ea.total_investment_usd != null && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <CurrencyDollarIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-green-400 font-semibold">
                        ${Number(ea.total_investment_usd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} invested
                      </span>
                    </div>
                  )}
                </div>

                {ea.myfxbook_url && (
                  <div className="mt-5 pt-4 border-t border-slate-800 flex gap-2">
                    <a
                      href={ea.myfxbook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary flex-1 justify-center"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      View on Myfxbook
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} AceCapital. All rights reserved.
      </footer>
    </div>
  );
}
