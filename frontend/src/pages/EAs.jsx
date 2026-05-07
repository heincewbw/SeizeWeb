import { useEffect, useState } from 'react';
import { easAPI } from '@/services/api';
import toast from 'react-hot-toast';
import {
  ArrowTopRightOnSquareIcon,
  CpuChipIcon,
  UserGroupIcon,
  ChartBarIcon,
  CalendarDaysIcon,
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

export default function EAs() {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Expert Advisors</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Browse available EAs and review their live performance before investing.
        </p>
      </div>

      {loading ? (
        <div className="card text-slate-500 text-sm">Loading...</div>
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
                  <UserGroupIcon className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>{ea.total_investors ?? 0} Investor</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <ChartBarIcon className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>Min Equity{ea.min_equity != null ? `: $${Number(ea.min_equity).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ': —'}</span>
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
    </div>
  );
}
