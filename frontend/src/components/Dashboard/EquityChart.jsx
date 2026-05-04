import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';

const TABS = ['Chart', 'Growth', 'Balance', 'Profit', 'Drawdown', 'Margin'];

// Diamond-shaped dot for equity growth line
const DiamondDot = (props) => {
  const { cx, cy, fill } = props;
  if (cx == null || cy == null) return null;
  const s = 3.5;
  return (
    <polygon
      points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
      fill={fill}
    />
  );
};

const USD_NAMES = ['Balance', 'Period Profit (USD)'];

const formatTooltipValue = (name, value) => {
  if (!USD_NAMES.includes(name)) return `${value.toFixed(2)}%`;
  const abs = Math.abs(value);
  const formatted = abs >= 1000 ? `${(abs / 1000).toFixed(2)}k` : abs.toFixed(2);
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-slate-700 rounded-lg p-3 shadow-xl text-xs min-w-[140px]">
      <p className="text-slate-400 mb-1.5 font-medium">{label}</p>
      {payload.map((entry) =>
        entry.value != null ? (
          <p key={entry.name} className="font-medium py-0.5" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? formatTooltipValue(entry.name, entry.value) : entry.value}
          </p>
        ) : null
      )}
    </div>
  );
};

export default function EquityChart({ data, loading }) {
  const [activeTab, setActiveTab] = useState('Chart');

  const chartData = useMemo(() => {
    if (!data?.length) return [];
    const firstEquity = parseFloat(data[0].equity) || 1;
    const firstBalance = parseFloat(data[0].balance) || 1;

    // Track running peak for drawdown
    let peakEquity = firstEquity;

    return data.map((d, i) => {
      const equity = parseFloat(d.equity);
      const balance = parseFloat(d.balance);
      const prevEquity = i > 0 ? parseFloat(data[i - 1].equity) : equity;

      const equityGrowth = ((equity - firstEquity) / firstEquity) * 100;
      const balanceGrowth = ((balance - firstBalance) / firstBalance) * 100;
      const periodProfit = i === 0 ? 0 : ((equity - prevEquity) / Math.abs(prevEquity)) * 100;
      const profitUsd = i === 0 ? 0 : equity - prevEquity;

      if (equity > peakEquity) peakEquity = equity;
      const drawdown = peakEquity > 0 ? ((equity - peakEquity) / peakEquity) * 100 : 0;

      return {
        date: format(new Date(d.created_at), "MMM dd, ''yy"),
        equityGrowth: parseFloat(equityGrowth.toFixed(2)),
        balanceGrowth: parseFloat(balanceGrowth.toFixed(2)),
        periodProfit: parseFloat(periodProfit.toFixed(2)),
        drawdown: parseFloat(drawdown.toFixed(2)),
        balanceUsd: parseFloat(balance.toFixed(2)),
        profitUsd: parseFloat(profitUsd.toFixed(2)),
      };
    });
  }, [data]);

  const showBars = activeTab === 'Chart';
  const showProfitUsd = activeTab === 'Profit';
  const showEquityLine = activeTab === 'Chart' || activeTab === 'Growth';
  const showBalanceLine = activeTab === 'Chart' || activeTab === 'Growth';
  const showBalanceUsd = activeTab === 'Balance';
  const showDrawdown = activeTab === 'Drawdown';
  const isUsdTab = activeTab === 'Balance' || activeTab === 'Profit';

  return (
    <div className="card">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab}
            {tab === 'Margin' && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-tight">
                New
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-56 bg-slate-800 rounded-lg animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-slate-500 gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 opacity-30">
            <path d="M3 17L7 13L11 15L15 9L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-sm">No equity data yet. Sync your account to see the chart.</p>
        </div>
      ) : activeTab === 'Margin' ? (
        <div className="h-56 flex flex-col items-center justify-center text-slate-500 gap-2">
          <p className="text-sm">Margin data not available yet.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#475569"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#475569"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                if (isUsdTab) {
                  return Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`;
                }
                return `${v}%`;
              }}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />

            {/* Period profit bars (% — Chart tab) */}
            {showBars && (
              <Bar dataKey="periodProfit" name="Period Profit" maxBarSize={7} radius={[1, 1, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={entry.periodProfit >= 0 ? '#22c55e' : '#ef4444'}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            )}
            {/* Period profit bars (USD — Profit tab) */}
            {showProfitUsd && (
              <Bar dataKey="profitUsd" name="Period Profit (USD)" maxBarSize={7} radius={[1, 1, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={entry.profitUsd >= 0 ? '#22c55e' : '#ef4444'}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            )}
            {showDrawdown && (
              <Bar dataKey="drawdown" name="Drawdown" maxBarSize={7} radius={[1, 1, 0, 0]} fill="#ef4444" fillOpacity={0.7} />
            )}

            {/* Equity Growth line — yellow with diamond dots */}
            {showEquityLine && (
              <Line
                type="monotone"
                dataKey="equityGrowth"
                name="Equity Growth"
                stroke="#eab308"
                strokeWidth={1.5}
                dot={<DiamondDot fill="#eab308" />}
                activeDot={{ r: 4, fill: '#eab308', strokeWidth: 0 }}
              />
            )}

            {/* Balance Growth line % — Chart/Growth tab */}
            {showBalanceLine && (
              <Line
                type="monotone"
                dataKey="balanceGrowth"
                name="Growth"
                stroke="#f43f5e"
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: '#f43f5e', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }}
              />
            )}
            {/* Balance USD line — Balance tab */}
            {showBalanceUsd && (
              <Line
                type="monotone"
                dataKey="balanceUsd"
                name="Balance"
                stroke="#38bdf8"
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: '#38bdf8', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#38bdf8', strokeWidth: 0 }}
              />
            )}

            {/* Drawdown line when Drawdown tab */}
            {showDrawdown && (
              <Line
                type="monotone"
                dataKey="drawdown"
                name="Drawdown"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {!loading && chartData.length > 0 && activeTab !== 'Margin' && (
        <div className="flex items-center justify-center gap-5 mt-3 flex-wrap">
          {showEquityLine && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg width="20" height="10">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#eab308" strokeWidth="1.5" />
                <polygon points="10,2 13,5 10,8 7,5" fill="#eab308" />
              </svg>
              <span>Equity Growth</span>
            </div>
          )}
          {showBalanceLine && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg width="20" height="10">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#f43f5e" strokeWidth="1.5" />
                <circle cx="10" cy="5" r="2.5" fill="#f43f5e" />
              </svg>
              <span>Growth</span>
            </div>
          )}
          {showBalanceUsd && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg width="20" height="10">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx="10" cy="5" r="2.5" fill="#38bdf8" />
              </svg>
              <span>Balance (USD)</span>
            </div>
          )}
          {showProfitUsd && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500 opacity-75" />
              <span>Profit per Periode (USD)</span>
            </div>
          )}
          {showDrawdown && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="inline-block w-5 border-t-2 border-red-500" />
              <span>Drawdown</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

