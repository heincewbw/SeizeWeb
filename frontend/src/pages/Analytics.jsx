import { useEffect, useState, useMemo } from 'react';
import { statsAPI, accountsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/format';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from 'recharts';
import { format } from 'date-fns';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

// Distinct pastel-ish colors matching the screenshot
const MONTH_COLORS = [
  '#a78bfa', // Jan - purple
  '#f87171', // Feb - rose
  '#2dd4bf', // Mar - teal
  '#fb923c', // Apr - orange
  '#fbbf24', // May - amber
  '#34d399', // Jun - emerald
  '#60a5fa', // Jul - blue
  '#c084fc', // Aug - violet
  '#f472b6', // Sep - pink
  '#a3e635', // Oct - lime
  '#38bdf8', // Nov - sky
  '#4ade80', // Dec - green
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PERIODS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '3M' },
  { value: '365d', label: '1Y' },
];

const MonthlyGainTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-1 font-medium">{label}</p>
      <p className="font-semibold" style={{ color: payload[0]?.fill }}>
        Gain: {payload[0]?.value?.toFixed(2)}%
      </p>
    </div>
  );
};

export default function Analytics() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [period, setPeriod] = useState('30d');
  const [equityChart, setEquityChart] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [monthlyGain, setMonthlyGain] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  useEffect(() => {
    accountsAPI.getAll().then(({ data }) => setAccounts(data.accounts));
  }, []);

  useEffect(() => {
    loadAnalytics();
    loadMonthly();
  }, [selectedAccount, period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [chartRes, breakdownRes] = await Promise.all([
        statsAPI.getEquityChart({ account_id: selectedAccount || undefined, period }),
        statsAPI.getSymbolBreakdown(selectedAccount || undefined),
      ]);
      setEquityChart(chartRes.data.chart);
      setBreakdown(breakdownRes.data.breakdown);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthly = async () => {
    setMonthlyLoading(true);
    try {
      const res = await statsAPI.getMonthlyGain(selectedAccount || undefined);
      setMonthlyGain(res.data.monthly);
    } catch {
      // non-critical, ignore
    } finally {
      setMonthlyLoading(false);
    }
  };

  const equityData = equityChart.map((d) => ({
    date: format(new Date(d.created_at), 'MMM dd'),
    equity: parseFloat(d.equity?.toFixed(2)),
    balance: parseFloat(d.balance?.toFixed(2)),
  }));

  const profitBySymbol = breakdown.map((d) => ({
    symbol: d.symbol,
    profit: parseFloat(d.profit?.toFixed(2)),
    trades: d.count,
  }));

  // Derived monthly data
  const availableYears = useMemo(() => {
    const years = [...new Set((monthlyGain || []).map((m) => m.year))].sort();
    return years;
  }, [monthlyGain]);

  const [selectedYear, setSelectedYear] = useState(null);

  const activeYear = selectedYear ?? availableYears[availableYears.length - 1] ?? new Date().getFullYear();

  const monthlyChartData = useMemo(() => {
    return (monthlyGain || [])
      .filter((m) => m.year === activeYear)
      .map((m) => ({
        label: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
        gainPct: m.gainPct,
        monthIndex: m.month - 1,
      }));
  }, [monthlyGain, activeYear]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Analytics</h2>
          <p className="text-sm text-slate-400 mt-0.5">Performance insights and breakdowns</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="input-field w-auto"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name}</option>
            ))}
          </select>
          <div className="flex bg-dark-800 border border-slate-700 rounded-lg p-1 gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === p.value
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">Equity Curve</h3>
        {loading ? (
          <div className="h-64 bg-slate-800 rounded-lg animate-pulse" />
        ) : equityData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500">No data for selected period</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={equityData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v) => [formatCurrency(v), '']}
              />
              <Legend iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGrad)" name="Equity" />
              <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={1.5} fill="url(#balanceGrad)" name="Balance" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Profit by Symbol Bar */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">P&L by Symbol</h3>
          {loading ? (
            <div className="h-48 bg-slate-800 rounded-lg animate-pulse" />
          ) : profitBySymbol.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500">No trade data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={profitBySymbol} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="symbol" stroke="#475569" tick={{ fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v) => [formatCurrency(v), 'Profit']}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {profitBySymbol.map((entry, index) => (
                    <Cell key={index} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trade Count by Symbol Pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">Trade Count by Symbol</h3>
          {loading ? (
            <div className="h-48 bg-slate-800 rounded-lg animate-pulse" />
          ) : breakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500">No data</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="count"
                    nameKey="symbol"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    strokeWidth={0}
                  >
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v, name) => [`${v} trades`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {breakdown.slice(0, 6).map((d, i) => (
                  <div key={d.symbol} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-slate-300 font-medium">{d.symbol}</span>
                    </div>
                    <span className="text-xs text-slate-500">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Analytics */}
      <div className="card">
        {/* Header row */}
        <div className="flex items-center gap-4 mb-5 flex-wrap">
          <h3 className="text-base font-bold text-slate-100">Monthly Analytics</h3>
          <div className="flex gap-1">
            {availableYears.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
                  activeYear === yr
                    ? 'bg-slate-600 text-slate-100'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
          Monthly Gain (Change)
        </p>

        {monthlyLoading ? (
          <div className="h-64 bg-slate-800 rounded-lg animate-pulse" />
        ) : monthlyChartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
            No monthly data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyChartData} margin={{ top: 24, right: 20, left: 0, bottom: 5 }} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#475569"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#475569"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                width={42}
              />
              <Tooltip content={<MonthlyGainTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
              <Bar dataKey="gainPct" name="Monthly Gain" radius={[3, 3, 0, 0]}>
                <LabelList
                  dataKey="gainPct"
                  position="top"
                  formatter={(v) => `${v}%`}
                  style={{ fontSize: '11px', fontWeight: 600, fill: '#cbd5e1' }}
                />
                {monthlyChartData.map((entry, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={entry.gainPct >= 0 ? MONTH_COLORS[entry.monthIndex % MONTH_COLORS.length] : '#ef4444'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
