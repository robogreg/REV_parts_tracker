'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { syncPendingTransactions, getPendingCount } from '@/lib/offline';
import toast from 'react-hot-toast';

export function OnlineDetector() {
  const setIsOnline = useAppStore((s) => s.setIsOnline);
  const setPendingCount = useAppStore((s) => s.setPendingCount);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    async function updatePendingCount() {
      try {
        const count = await getPendingCount();
        setPendingCount(count);
      } catch {
        // IndexedDB not available
      }
    }

    async function handleOnline() {
      setIsOnline(true);
      try {
        const { synced, failed } = await syncPendingTransactions();
        await updatePendingCount();
        if (synced > 0) {
          toast.success(`Synced ${synced} transaction${synced !== 1 ? 's' : ''}`);
        }
        if (failed > 0) {
          toast.error(`${failed} transaction${failed !== 1 ? 's' : ''} failed to sync`);
        }
      } catch {
        // Sync not critical
      }
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleSyncComplete(e: Event) {
      const { synced, failed } = (e as CustomEvent<{ synced: number; failed: number }>).detail;
      updatePendingCount();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('rev-sync-complete', handleSyncComplete);

    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('rev-sync-complete', handleSyncComplete);
    };
  }, [setIsOnline, setPendingCount]);

  return null;
}
