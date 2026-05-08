import { useEffect, useState } from 'react';
import { adminAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/format';
import {
  BanknotesIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
  ChartBarIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';

const RevCard = ({ icon: Icon, label, value, sub, color = 'brand' }) => {
  const colors = {
    brand: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    red:   'text-red-400 bg-red-500/10 border-red-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    blue:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
          <p className="text-2xl font-bold text-slate-100 mt-1.5">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default function AdminRevenue() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await adminAPI.getRevenue();
        setData(res);
      } catch {
        toast.error('Failed to load revenue data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Revenue Dashboard</h2>
          <p className="text-sm text-slate-400 mt-0.5">Platform financial overview</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-slate-800/40" />
          ))}
        </div>
      </div>
    );
  }

  const netFlow = data?.net_monthly_flow || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Revenue Dashboard</h2>
        <p className="text-sm text-slate-400 mt-0.5">Platform financial overview — refreshed on page load</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RevCard
          icon={BanknotesIcon}
          label="Total AUM"
          value={formatCurrency(data?.total_aum || 0)}
          sub={`Initial capital: ${formatCurrency(data?.total_initial || 0)}`}
          color="brand"
        />
        <RevCard
          icon={UsersIcon}
          label="Active Investors"
          value={data?.active_investors || 0}
          sub={`${data?.total_investors || 0} total registered`}
          color="blue"
        />
        <RevCard
          icon={ChartBarIcon}
          label="Commission Earned"
          value={formatCurrency(data?.total_commission_earned || 0)}
          sub="Based on commission rates × capital"
          color="amber"
        />
        <RevCard
          icon={UserPlusIcon}
          label="New This Month"
          value={data?.new_investors_this_month || 0}
          sub="New investors registered"
          color="green"
        />
        <RevCard
          icon={ArrowUpCircleIcon}
          label="Monthly Deposits"
          value={formatCurrency(data?.monthly_deposits || 0)}
          sub="Deposits detected this month"
          color="green"
        />
        <RevCard
          icon={ArrowDownCircleIcon}
          label="Monthly Withdrawals"
          value={formatCurrency(data?.monthly_withdrawals || 0)}
          sub="Verified withdrawals this month"
          color="red"
        />
        <div className="card sm:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Net Monthly Flow</p>
              <p className={`text-2xl font-bold mt-1.5 ${netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Deposits minus withdrawals this month</p>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${netFlow >= 0 ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
              {netFlow >= 0 ? <ArrowTrendingUpIcon className="w-5 h-5" /> : <ArrowTrendingDownIcon className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
