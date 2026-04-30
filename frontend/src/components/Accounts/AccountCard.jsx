import { useState } from 'react';
import { formatCurrency, formatDate } from '@/utils/format';
import { ArrowPathIcon, XMarkIcon, ClipboardIcon, ClipboardDocumentCheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '@/services/api';

export default function AccountCard({ account, isAdmin, onSync, onDisconnect, onDelete, isSyncing }) {
  const [bridgeToken, setBridgeToken] = useState(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const equity = account.equity || 0;
  const balance = account.balance || 0;
  const profitPct = balance > 0 ? (((equity - balance) / balance) * 100).toFixed(2) : 0;
  const isProfit = equity >= balance;

  const handleShowToken = async () => {
    if (bridgeToken) {
      setBridgeToken(null);
      return;
    }
    setLoadingToken(true);
    try {
      const res = await api.get(`/api/mt4/token?login=${account.login}&server=${encodeURIComponent(account.server)}`);
      setBridgeToken(res.data.bridge_token);
    } catch {
      // ignore
    } finally {
      setLoadingToken(false);
    }
  };

  const handleCopy = () => {
    if (!bridgeToken) return;
    navigator.clipboard.writeText(bridgeToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card hover:border-slate-600 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-100">{account.account_name}</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">{account.login} @ {account.server}</p>
        </div>
        <div className="flex items-center gap-1">
          {account.is_connected ? (
            <span className="badge-green">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="badge-yellow">Offline</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-dark-900 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-0.5">Balance</p>
          <p className="font-mono font-semibold text-slate-100">{formatCurrency(balance)}</p>
        </div>
        <div className="bg-dark-900 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-0.5">Equity</p>
          <p className={`font-mono font-semibold ${isProfit ? 'text-brand-400' : 'text-danger-400'}`}>
            {formatCurrency(equity)}
          </p>
        </div>
        <div className="bg-dark-900 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-0.5">Floating P/L</p>
          <p className={`font-mono font-semibold text-sm ${account.profit >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
            {formatCurrency(account.profit || 0)}{' '}
            <span className="text-xs opacity-70">({profitPct}%)</span>
          </p>
        </div>
        <div className="bg-dark-900 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-0.5">Free Margin</p>
          <p className="font-mono font-semibold text-slate-300 text-sm">{formatCurrency(account.free_margin || 0)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <div className="text-xs text-slate-600">
          {account.currency} · 1:{account.leverage} · {account.broker}
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {isAdmin && (
            <>
              <button
                onClick={handleShowToken}
                disabled={loadingToken}
                className="btn-secondary px-2.5 py-1.5 text-xs"
                title="EA Bridge Token"
              >
                {loadingToken ? (
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span className="text-xs font-mono">EA</span>
                )}
              </button>
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="btn-secondary px-2.5 py-1.5 text-xs"
                title="Sync account"
              >
                <ArrowPathIcon className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onDisconnect}
                className="btn-secondary px-2.5 py-1.5 text-xs"
                title="Disconnect"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="btn-danger px-2.5 py-1.5 text-xs"
                title="Delete account"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bridge Token Section */}
      {bridgeToken && (
        <div className="mt-3 p-3 bg-dark-900 rounded-lg border border-brand-500/30">
          <p className="text-xs text-brand-400 font-semibold mb-1">EA Bridge Token</p>
          <p className="text-xs text-slate-500 mb-2">
            Masukkan token ini ke input <span className="font-mono text-slate-400">BridgeToken</span> di EA SeizeBridge.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-slate-300 bg-dark-800 px-2 py-1.5 rounded truncate">
              {bridgeToken}
            </code>
            <button
              onClick={handleCopy}
              className="btn-secondary px-2 py-1.5 flex-shrink-0"
              title="Copy token"
            >
              {copied ? (
                <ClipboardDocumentCheckIcon className="w-4 h-4 text-brand-400" />
              ) : (
                <ClipboardIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {account.last_synced && (
        <p className="text-xs text-slate-700 mt-2">Last synced: {formatDate(account.last_synced)}</p>
      )}
    </div>
  );
}
