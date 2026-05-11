import { useEffect, useState } from 'react';
import { accountsAPI, statsAPI } from '@/services/api';
import useDashboardStore from '@/store/useDashboardStore';
import toast from 'react-hot-toast';
import StatCard from '@/components/Dashboard/StatCard';
import EquityChart from '@/components/Dashboard/EquityChart';
import AccountSelector from '@/components/Dashboard/AccountSelector';
import PortfolioShareChart from '@/components/Dashboard/PortfolioShareChart';
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatPercent } from '@/utils/format';

export default function Dashboard() {
  const { accounts, setAccounts, selectedAccountId, setSelectedAccountId, summary, setSummary } = useDashboardStore();
  const [equityChart, setEquityChart] = useState([]);
  const [portfolioShare, setPortfolioShare] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch accounts only once — account list doesn't change while the user is on this page
  useEffect(() => {
    if (accounts.length === 0) {
      accountsAPI.getAll().then(({ data }) => setAccounts(data.accounts)).catch(() => {});
    }
  }, []);

  // Refresh stats & chart whenever the selected account changes
  useEffect(() => {
    loadStats();
  }, [selectedAccountId]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [summaryRes, chartRes, shareRes] = await Promise.all([
        statsAPI.getSummary(selectedAccountId),
        statsAPI.getEquityChart({ account_id: selectedAccountId, period: '30d' }),
        statsAPI.getPortfolioShare(),
      ]);

      setSummary(summaryRes.data);
      setEquityChart(chartRes.data.chart);
      setPortfolioShare(shareRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const stats = summary?.summary;
  const tradeStats = summary?.tradeStats;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Portfolio Overview</h2>
          <p className="text-sm text-slate-400 mt-0.5">Real-time MT4 trading summary</p>
        </div>
        <AccountSelector
          accounts={accounts}
          selected={selectedAccountId}
          onChange={setSelectedAccountId}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Balance"
          value={formatCurrency(stats?.totalBalance)}
          icon={BanknotesIcon}
          loading={loading}
          color="green"
        />
        <StatCard
          title="Total Equity"
          value={formatCurrency(stats?.totalEquity)}
          icon={ScaleIcon}
          loading={loading}
          color="blue"
          sub={stats && `${formatCurrency(stats.totalProfit)} floating P/L`}
          subColor={stats?.totalProfit >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Win Rate"
          value={tradeStats ? `${tradeStats.winRate}%` : '—'}
          icon={ChartBarIcon}
          loading={loading}
          color="purple"
          sub={tradeStats && `${tradeStats.totalTrades} total trades`}
        />
        <StatCard
          title="Profit Factor"
          value={tradeStats?.profitFactor ?? '—'}
          icon={ArrowTrendingUpIcon}
          loading={loading}
          color="yellow"
          sub={tradeStats && `${tradeStats.winningTrades}W / ${tradeStats.losingTrades}L`}
        />
      </div>

      {/* Charts & Positions Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <EquityChart data={equityChart} loading={loading} />
        </div>
        <div className="flex flex-col gap-6">
          <PortfolioShareChart data={portfolioShare} loading={loading} />
        </div>
      </div>

      {/* Trade Stats Row */}
      <div className="card">
        <h3 className="font-semibold text-slate-200 mb-4 text-sm uppercase tracking-wide">Trade Stats</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Trades', value: tradeStats?.totalTrades ?? '—' },
            { label: 'Winning Trades', value: tradeStats?.winningTrades ?? '—', color: 'text-brand-400' },
            { label: 'Losing Trades', value: tradeStats?.losingTrades ?? '—', color: 'text-danger-400' },
            { label: 'Gross Profit', value: formatCurrency(tradeStats?.grossProfit), color: 'text-brand-400' },
            { label: 'Gross Loss', value: formatCurrency(tradeStats?.grossLoss ? -tradeStats.grossLoss : 0), color: 'text-danger-400' },
            { label: 'Net P&L', value: formatCurrency(tradeStats?.totalPnl), color: tradeStats?.totalPnl >= 0 ? 'text-brand-400' : 'text-danger-400' },
            { label: 'Connected Accounts', value: stats?.totalAccounts ?? '—' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`text-sm font-medium font-mono ${color || 'text-slate-100'}`}>{loading ? '...' : value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
