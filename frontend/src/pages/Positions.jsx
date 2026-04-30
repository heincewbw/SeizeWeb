import { useEffect, useState } from 'react';
import { positionsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const typeColors = {
  BUY: 'badge-green',
  SELL: 'badge-red',
};

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
                {['Ticket', 'Symbol', 'Type', 'Lots', 'Open Price', 'Current', 'S/L', 'T/P', 'Swap', 'Profit', 'Open Time'].map((h) => (
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
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-slate-500">
                    No open positions found
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr key={pos.ticket} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{pos.ticket}</td>
                    <td className="px-4 py-3 font-semibold text-slate-100">{pos.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={typeColors[pos.type] || 'badge-yellow'}>{pos.type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{pos.lots?.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{pos.openPrice?.toFixed(5)}</td>
                    <td className="px-4 py-3 font-mono text-slate-100">{pos.currentPrice?.toFixed(5)}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{pos.stopLoss > 0 ? pos.stopLoss.toFixed(5) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{pos.takeProfit > 0 ? pos.takeProfit.toFixed(5) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{pos.swap?.toFixed(2)}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${pos.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                      {formatCurrency(pos.profit)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(pos.openTime)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
