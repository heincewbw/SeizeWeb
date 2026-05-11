import { useEffect, useState } from 'react';
import { positionsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/format';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const typeColors = {
  BUY: 'badge-green',
  SELL: 'badge-red',
};

function aggregatePositions(positions) {
  const map = {};
  for (const p of positions) {
    const key = `${p.symbol}|${p.type}`;
    if (!map[key]) {
      map[key] = {
        symbol: p.symbol,
        type: p.type,
        count: 0,
        lots: 0,
        profit: 0,
        swap: 0,
        weightedPrice: 0,
      };
    }
    const g = map[key];
    // weighted average open price by lots
    g.weightedPrice += (p.openPrice || 0) * (p.lots || 0);
    g.lots += p.lots || 0;
    g.profit += p.profit || 0;
    g.swap += p.swap || 0;
    g.count += p.count || 1; // EA sends pre-aggregated count; fallback to 1 for legacy per-ticket rows
    // keep latest currentPrice
    g.currentPrice = p.currentPrice;
  }
  return Object.values(map).map((g) => ({
    ...g,
    avgOpenPrice: g.lots > 0 ? g.weightedPrice / g.lots : 0,
  })).sort((a, b) => a.symbol.localeCompare(b.symbol) || a.type.localeCompare(b.type));
}

export default function Positions() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    setLoading(true);
    try {
      const { data } = await positionsAPI.getOpen();
      setPositions(data.positions);
    } catch {
      toast.error('Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  const totalProfit = positions.reduce((sum, p) => sum + (p.profit || 0), 0);
  const grouped = aggregatePositions(positions);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Open Positions</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {positions.length} active trade{positions.length !== 1 ? 's' : ''} — Floating P/L:{' '}
            <span className={totalProfit >= 0 ? 'text-brand-400' : 'text-danger-400'}>
              {formatCurrency(totalProfit)}
            </span>
          </p>
        </div>
        <button onClick={loadPositions} className="btn-secondary" disabled={loading}>
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                {['Symbol', 'Type', 'Positions', 'Total Lots', 'Avg Open Price', 'Current Price', 'Floating P/L'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : grouped.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-500">
                    No open positions found
                  </td>
                </tr>
              ) : (
                grouped.map((g) => (
                  <tr key={`${g.symbol}|${g.type}`} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-100">{g.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={typeColors[g.type] || 'badge-yellow'}>{g.type}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{g.count}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{g.lots.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{g.avgOpenPrice.toFixed(5)}</td>
                    <td className="px-4 py-3 font-mono text-slate-100">{g.currentPrice?.toFixed(5) ?? '—'}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${g.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                      {formatCurrency(g.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {grouped.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-800/30">
                  <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-slate-400">Total</td>
                  <td className={`px-4 py-3 font-mono font-bold ${totalProfit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                    {formatCurrency(totalProfit)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
