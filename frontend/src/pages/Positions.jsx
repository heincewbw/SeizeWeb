import { useEffect, useMemo, useState } from 'react';
import { positionsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/format';
import { ArrowPathIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

const typeColors = {
  BUY: 'badge-green',
  SELL: 'badge-red',
};

// Convert broker symbol (e.g. "EURUSDc", "XAUUSDm") to TradingView format
function toTVSymbol(rawSymbol) {
  // Strip non-alpha chars, keep first 6 uppercase letters as the pair
  const clean = rawSymbol.replace(/[^A-Za-z]/g, '').toUpperCase();
  const six = clean.slice(0, 6);
  if (six === 'XAUUSD') return 'TVC:GOLD';
  if (six === 'XAGUSD') return 'TVC:SILVER';
  if (six === 'XPTUSD') return 'TVC:PLATINUM';
  if (six === 'USOIL' || six === 'WTIUSD') return 'TVC:USOIL';
  if (/^[A-Z]{6}$/.test(six)) return `FX:${six}`;
  return `FX:${clean}`;
}

// TradingView Advanced Chart widget + avg open price overlay
function PositionChart({ groups }) {
  // Pick symbol+type group with the most lots
  const dominant = useMemo(() => {
    if (!groups.length) return null;
    return [...groups].sort((a, b) => b.lots - a.lots)[0];
  }, [groups]);

  if (!dominant) return null;

  const tvSymbol = toTVSymbol(dominant.symbol);
  const avgPrice = dominant.avgOpenPrice;
  const curPrice = dominant.currentPrice || avgPrice;

  // Build TradingView widgetembed iframe URL — most reliable embed method in React SPAs
  const params = new URLSearchParams({
    symbol: tvSymbol,
    interval: '60',           // H1
    theme: 'dark',
    style: '1',               // candlestick
    locale: 'en',
    timezone: 'Asia/Jakarta',
    autosize: '1',
    hide_side_toolbar: '0',
    allow_symbol_change: '0',
    save_image: '0',
    hide_volume: '0',
    withdateranges: '1',
  });
  const iframeSrc = `https://www.tradingview.com/widgetembed/?${params.toString()}`;

  // Estimate if avgPrice falls within TradingView chart's visible range.
  // H1 forex charts typically show ~1.5% of price vertically.
  const RANGE = 0.015;
  const topEst = curPrice * (1 + RANGE * 0.60);
  const botEst = curPrice * (1 - RANGE * 0.40);

  const above = avgPrice > topEst;
  const below = avgPrice < botEst;
  const inRange = !above && !below;

  // Vertical % position of the avg price line (0 = top, 100 = bottom)
  const lineTopPct = inRange
    ? Math.max(3, Math.min(94, ((topEst - avgPrice) / (topEst - botEst)) * 100))
    : null;

  return (
    <div className="card overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-100 text-base">{dominant.symbol}</span>
          <span className={typeColors[dominant.type] || 'badge-yellow'}>{dominant.type}</span>
          <span className="text-xs text-slate-500">
            {dominant.lots.toFixed(2)} lots &middot; {dominant.count} position{dominant.count !== 1 ? 's' : ''} &middot; largest exposure
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Avg Open</p>
            <p className="font-mono text-red-400 font-semibold text-sm">{avgPrice.toFixed(5)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Current</p>
            <p className="font-mono text-slate-200 font-semibold text-sm">{curPrice.toFixed(5)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Floating P/L</p>
            <p className={`font-mono font-semibold text-sm ${dominant.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
              {formatCurrency(dominant.profit)}
            </p>
          </div>
        </div>
      </div>

      {/* Chart + overlay */}
      <div className="relative" style={{ height: 460 }}>
        <iframe
          key={tvSymbol}
          src={iframeSrc}
          title={`${dominant.symbol} chart`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allowFullScreen
        />

        {/* Avg open price indicator */}
        {lineTopPct !== null ? (
          // Price is within estimated visible range — draw dashed line
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
            style={{ top: `${lineTopPct}%` }}
          >
            <div className="flex-1 border-t-2 border-dashed border-red-500" style={{ opacity: 0.85 }} />
            <div className="bg-red-600 text-white text-[11px] font-mono px-2 py-0.5 rounded-l font-semibold whitespace-nowrap shadow-lg">
              AVG&nbsp;{avgPrice.toFixed(5)}
            </div>
          </div>
        ) : above ? (
          // Avg price is above the visible chart range
          <div className="absolute top-3 right-4 pointer-events-none z-10">
            <div className="flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-mono px-3 py-1.5 rounded-full shadow-lg">
              <ArrowUpIcon className="w-3 h-3" />
              AVG {avgPrice.toFixed(5)}
            </div>
          </div>
        ) : (
          // Avg price is below the visible chart range
          <div className="absolute bottom-5 right-4 pointer-events-none z-10">
            <div className="flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-mono px-3 py-1.5 rounded-full shadow-lg">
              <ArrowDownIcon className="w-3 h-3" />
              AVG {avgPrice.toFixed(5)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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

      {/* TradingView chart for dominant symbol */}
      {!loading && grouped.length > 0 && (
        <PositionChart groups={grouped} />
      )}
    </div>
  );
}
