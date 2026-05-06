import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/utils/format';

const COLORS = ['#6366f1', '#1e293b'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-dark-800 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-300 font-medium">{name}</p>
      <p className="text-slate-400 mt-0.5">{formatCurrency(value)}</p>
    </div>
  );
};

const CustomLabel = ({ cx, cy, percentage }) => (
  <>
    <text x={cx} y={cy - 10} textAnchor="middle" fill="#e2e8f0" fontSize={22} fontWeight={700}>
      {percentage}%
    </text>
    <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={11}>
      of total pool
    </text>
  </>
);

export default function PortfolioShareChart({ data, loading }) {
  if (loading) {
    return (
      <div className="card h-full flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat...</p>
      </div>
    );
  }

  const { userBalance = 0, otherBalance = 0, totalBalance = 0, percentage = 0, totalUsers = 0 } = data || {};

  const chartData = [
    { name: 'Portfolio Anda', value: userBalance },
    { name: 'Investor Lain', value: otherBalance },
  ];

  return (
    <div className="card h-full flex flex-col">
      <h3 className="font-semibold text-slate-200 mb-1 text-sm uppercase tracking-wide">
        Portfolio Share
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Kontribusi kamu dari total pool {totalUsers} investor
      </p>

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-full" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {/* Center label */}
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle">
                <CustomLabel cx="50%" cy="50%" percentage={percentage} />
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="w-full space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-slate-400">Portfolio Anda</span>
            </div>
            <span className="font-mono font-medium text-slate-200">{formatCurrency(userBalance)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700 shrink-0" />
              <span className="text-slate-400">Investor Lain</span>
            </div>
            <span className="font-mono font-medium text-slate-200">{formatCurrency(otherBalance)}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/50">
            <span className="text-slate-500">Total Pool</span>
            <span className="font-mono font-semibold text-slate-100">{formatCurrency(totalBalance)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
