import Dexie, { Table } from 'dexie';
import type {
  PendingTransaction,
  CachedEvent,
  CachedInventory,
  CachedTeams,
  Transaction,
} from './types';
import { getAuthHeaders } from './firebase-client';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

class RevPartsDatabase extends Dexie {
  pendingTransactions!: Table<PendingTransaction>;
  cachedEvents!: Table<CachedEvent>;
  cachedInventory!: Table<CachedInventory>;
  cachedTeams!: Table<CachedTeams>;

  constructor() {
    super('RevPartsDB');
    this.version(1).stores({
      pendingTransactions: 'id, eventId, syncStatus, createdLocally',
      cachedEvents: 'id, cachedAt',
      cachedInventory: 'eventId, cachedAt',
      cachedTeams: 'eventId, cachedAt',
    });
  }
}

let _db: RevPartsDatabase | null = null;

function getDb(): RevPartsDatabase {
  if (typeof window === 'undefined') throw new Error('IndexedDB is client-only');
  if (!_db) _db = new RevPartsDatabase();
  return _db;
}

// ─── Pending Transactions ─────────────────────────────────────────────────────

export async function savePendingTransaction(tx: Transaction): Promise<void> {
  const db = getDb();
  await db.pendingTransactions.put({
    ...tx,
    syncStatus: 'pending',
    retryCount: 0,
    createdLocally: new Date().toISOString(),
  });
}

export async function getPendingCount(): Promise<number> {
  const db = getDb();
  return db.pendingTransactions.where('syncStatus').equals('pending').count();
}

export async function syncPendingTransactions(): Promise<{ synced: number; failed: number }> {
  const db = getDb();
  const pending = await db.pendingTransactions.where('syncStatus').equals('pending').toArray();

  let synced = 0;
  let failed = 0;

  const headers = await getAuthHeaders().catch(() => null);
  if (!headers) return { synced: 0, failed: pending.length };

  for (const tx of pending) {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(tx),
      });
      if (res.ok) {
        await db.pendingTransactions.delete(tx.id);
        synced++;
      } else {
        const retryCount = (tx.retryCount ?? 0) + 1;
        await db.pendingTransactions.update(tx.id, {
          retryCount,
          syncStatus: retryCount >= 3 ? 'failed' : 'pending',
        });
        failed++;
      }
    } catch {
      const retryCount = (tx.retryCount ?? 0) + 1;
      await db.pendingTransactions.update(tx.id, {
        retryCount,
        syncStatus: retryCount >= 3 ? 'failed' : 'pending',
      });
      failed++;
    }
  }

  if (synced > 0 || failed > 0) {
    window.dispatchEvent(
      new CustomEvent('rev-sync-complete', { detail: { synced, failed } })
    );
  }

  return { synced, failed };
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

export async function getCachedEvents() {
  const db = getDb();
  const cached = await db.cachedEvents.get('all');
  if (!cached || Date.now() - cached.cachedAt > CACHE_TTL) return null;
  return cached.data;
}

export async function setCachedEvents(data: CachedEvent['data']) {
  const db = getDb();
  await db.cachedEvents.put({ id: 'all', data, cachedAt: Date.now() });
}

export async function getCachedInventory(eventId: string) {
  const db = getDb();
  const cached = await db.cachedInventory.get(eventId);
  if (!cached || Date.now() - cached.cachedAt > CACHE_TTL) return null;
  return cached.data;
}

export async function setCachedInventory(eventId: string, data: CachedInventory['data']) {
  const db = getDb();
  await db.cachedInventory.put({ eventId, data, cachedAt: Date.now() });
}

export async function getCachedTeams(eventId: string) {
  const db = getDb();
  const cached = await db.cachedTeams.get(eventId);
  if (!cached || Date.now() - cached.cachedAt > CACHE_TTL) return null;
  return cached.data;
}

export async function setCachedTeams(eventId: string, data: CachedTeams['data']) {
  const db = getDb();
  await db.cachedTeams.put({ eventId, data, cachedAt: Date.now() });
}

// ─── Recent local transactions (for transaction history per device) ───────────

export async function getLocalRecentTransactions(limit = 5): Promise<PendingTransaction[]> {
  const db = getDb();
  return db.pendingTransactions
    .orderBy('createdLocally')
    .reverse()
    .limit(limit)
    .toArray();
}
