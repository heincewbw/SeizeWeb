import { ArrowTopRightOnSquareIcon, CpuChipIcon, ShieldCheckIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const eas = [
  {
    id: 'seize',
    name: 'Seize',
    tagline: 'Smart momentum capture EA',
    description:
      'Seize is a multi-strategy expert advisor designed to capture momentum across major forex pairs with disciplined risk management.',
    myfxbookUrl: 'https://www.myfxbook.com/portfolio/seize/11734037',
    tags: ['Forex', 'Momentum', 'Multi-Pair'],
    status: 'Available',
  },
];

export default function EAs() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Expert Advisors</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Browse available EAs and review their live performance before investing.
        </p>
      </div>

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
                  <p className="text-xs text-slate-500">{ea.tagline}</p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20 whitespace-nowrap">
                {ea.status}
              </span>
            </div>

            <p className="text-sm text-slate-400 mt-4 leading-relaxed">{ea.description}</p>

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

            <div className="grid grid-cols-2 gap-2 mt-5 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheckIcon className="w-4 h-4 text-brand-400" />
                Verified Track Record
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <ChartBarIcon className="w-4 h-4 text-brand-400" />
                Live Myfxbook
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex gap-2">
              <a
                href={ea.myfxbookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex-1 justify-center"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                View on Myfxbook
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
