import clsx from 'clsx';

const colorMap = {
  green: { icon: 'bg-brand-500/15 text-brand-400', border: 'border-brand-500/10' },
  blue: { icon: 'bg-blue-500/15 text-blue-400', border: 'border-blue-500/10' },
  purple: { icon: 'bg-purple-500/15 text-purple-400', border: 'border-purple-500/10' },
  yellow: { icon: 'bg-yellow-500/15 text-yellow-400', border: 'border-yellow-500/10' },
  red: { icon: 'bg-danger-500/15 text-danger-400', border: 'border-danger-500/10' },
};

export default function StatCard({ title, value, icon: Icon, loading, color = 'green', sub, subColor }) {
  const colors = colorMap[color] || colorMap.green;

  return (
    <div className={clsx('stat-card', colors.border)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{title}</span>
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', colors.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {loading ? (
        <div className="h-7 bg-slate-700 rounded animate-pulse w-3/4" />
      ) : (
        <p className="text-2xl font-bold text-slate-100 font-mono leading-tight">{value ?? '—'}</p>
      )}
      {sub && !loading && (
        <p className={clsx('text-xs', subColor === 'green' ? 'text-brand-400' : subColor === 'red' ? 'text-danger-400' : 'text-slate-500')}>
          {sub}
        </p>
      )}
    </div>
  );
}
