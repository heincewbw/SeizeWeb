import { formatCurrency, formatDate } from '@/utils/format';

export default function OpenPositionsTable({ positions, loading }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Open Positions</h3>
        <span className="badge-green">{loading ? '...' : positions.length} Active</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              {['Symbol', 'Type', 'Lots', 'Open Price', 'S/L', 'T/P', 'Floating P/L', 'Open Time'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-700/60 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : positions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-500 text-sm">
                  No open positions
                </td>
              </tr>
            ) : (
              positions.map((pos) => (
                <tr key={pos.ticket} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-100">{pos.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={pos.type === 'BUY' ? 'badge-green' : 'badge-red'}>{pos.type}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">{pos.lots?.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{pos.openPrice?.toFixed(5)}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{pos.stopLoss > 0 ? pos.stopLoss.toFixed(5) : '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{pos.takeProfit > 0 ? pos.takeProfit.toFixed(5) : '—'}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${pos.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                    {formatCurrency(pos.profit)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(pos.openTime)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
