'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { syncPendingTransactions } from '@/lib/offline';
import { useState } from 'react';

export function SyncBanner() {
  const isOnline = useAppStore((s) => s.isOnline);
  const pendingCount = useAppStore((s) => s.pendingCount);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncPendingTransactions();
    } finally {
      setSyncing(false);
    }
  }

  if (isOnline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <div className="bg-amber-900/30 border-b border-amber-800/50 px-4 py-2 flex items-center gap-2 text-amber-300 text-sm">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span>
          Offline — transactions will be saved and synced when connected
          {pendingCount > 0 && ` (${pendingCount} pending)`}
        </span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-[#FF6B00]/10 border-b border-[#FF6B00]/30 px-4 py-2 flex items-center justify-between text-[#FF6B00] text-sm">
        <span>{pendingCount} transaction{pendingCount !== 1 ? 's' : ''} pending sync</span>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs underline hover:no-underline min-h-0 min-w-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          Sync now
        </button>
      </div>
    );
  }

  return null;
}
