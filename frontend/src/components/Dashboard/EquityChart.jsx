import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/format';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

export default function EquityChart({ data, loading }) {
  const chartData = (data || []).map((d) => ({
    date: format(new Date(d.created_at), 'MMM dd'),
    equity: parseFloat(d.equity?.toFixed(2)),
    balance: parseFloat(d.balance?.toFixed(2)),
  }));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Equity Curve (30 Days)</h3>
      </div>

      {loading ? (
        <div className="h-52 bg-slate-800 rounded-lg animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="h-52 flex flex-col items-center justify-center text-slate-500 gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 opacity-30">
            <path d="M3 17L7 13L11 15L15 9L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm">No equity data yet. Sync your account to see the chart.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis stroke="#475569" tick={{ fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#equityFill)"
              name="Equity"
              dot={false}
              activeDot={{ r: 4, fill: '#10b981' }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#3b82f6"
              strokeWidth={1.5}
              fill="none"
              name="Balance"
              dot={false}
              strokeDasharray="4 2"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
