/**
 * Server-side Firestore helpers using Firebase Admin SDK.
 * This file is only used in API routes (Node.js) — never in the browser.
 * The Admin SDK bypasses Firestore security rules, which is correct for
 * server-side operations that have already been auth-checked by requireAuth().
 */
import { adminDb } from './firebase-admin';
import type { RevEvent, InventoryItem, Team, Transaction, Part, AdminLog } from './types';
import { generateId } from './utils';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvents(filters: { status?: string; program?: string } = {}): Promise<RevEvent[]> {
  let q = adminDb().collection('events').orderBy('startDate', 'desc') as FirebaseFirestore.Query;
  if (filters.status) q = q.where('status', '==', filters.status);
  if (filters.program) q = q.where('program', '==', filters.program);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RevEvent));
}

export async function getEvent(id: string): Promise<RevEvent | null> {
  const snap = await adminDb().collection('events').doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as RevEvent) : null;
}

export async function createEvent(data: Omit<RevEvent, 'id' | 'createdAt'>): Promise<RevEvent> {
  const id = generateId();
  const event: RevEvent = { ...data, id, createdAt: new Date().toISOString() };
  await adminDb().collection('events').doc(id).set(event);
  return event;
}

export async function updateEvent(id: string, data: Partial<RevEvent>): Promise<void> {
  await adminDb().collection('events').doc(id).update(data as FirebaseFirestore.UpdateData<RevEvent>);
}

export async function deleteEvent(id: string): Promise<void> {
  await adminDb().collection('events').doc(id).delete();
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getInventory(eventId: string): Promise<InventoryItem[]> {
  const snap = await adminDb()
    .collection('events').doc(eventId).collection('inventory')
    .get();
  const items = snap.docs.map((d) => d.data() as InventoryItem);
  // Sort in memory — avoids needing a composite Firestore index on part.category + part.name
  items.sort((a, b) => {
    const cat = a.part.category.localeCompare(b.part.category);
    return cat !== 0 ? cat : a.part.name.localeCompare(b.part.name);
  });
  return items;
}

export async function upsertInventoryItem(eventId: string, item: InventoryItem): Promise<void> {
  await adminDb()
    .collection('events').doc(eventId).collection('inventory').doc(item.id)
    .set({ ...item, eventId });
}

export async function updateInventoryItem(
  eventId: string,
  itemId: string,
  data: Partial<InventoryItem>
): Promise<void> {
  await adminDb()
    .collection('events').doc(eventId).collection('inventory').doc(itemId)
    .update(data as FirebaseFirestore.UpdateData<InventoryItem>);
}

export async function deleteInventoryItem(eventId: string, itemId: string): Promise<void> {
  await adminDb()
    .collection('events').doc(eventId).collection('inventory').doc(itemId)
    .delete();
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function getTeams(eventId: string): Promise<Team[]> {
  const snap = await adminDb()
    .collection('events').doc(eventId).collection('teams')
    .orderBy('teamNumber')
    .get();
  return snap.docs.map((d) => d.data() as Team);
}

export async function upsertTeam(eventId: string, team: Team): Promise<void> {
  await adminDb().collection('events').doc(eventId).collection('teams').doc(team.id).set(team);
}

export async function deleteTeam(eventId: string, teamId: string): Promise<void> {
  await adminDb().collection('events').doc(eventId).collection('teams').doc(teamId).delete();
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransactionFilters {
  eventId?: string;
  staffEmail?: string;
  teamNumber?: string;
  from?: string;
  to?: string;
  loaner?: boolean;
  limit?: number;
  offset?: number;
}

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<{ transactions: Transaction[]; total: number }> {
  let q = adminDb().collection('transactions').orderBy('timestamp', 'desc') as FirebaseFirestore.Query;
  if (filters.eventId) q = q.where('eventId', '==', filters.eventId);
  if (filters.staffEmail) q = q.where('staffEmail', '==', filters.staffEmail);

  const snap = await q.get();
  let transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));

  // Client-side filters for fields not suitable for compound Firestore queries
  if (filters.teamNumber) {
    transactions = transactions.filter((t) => String(t.teamNumber) === filters.teamNumber);
  }
  if (filters.from) {
    transactions = transactions.filter((t) => t.timestamp >= filters.from!);
  }
  if (filters.to) {
    transactions = transactions.filter((t) => t.timestamp <= filters.to!);
  }
  if (filters.loaner !== undefined) {
    transactions = transactions.filter((t) =>
      filters.loaner ? t.items.some((i) => i.isLoaner) : t.items.every((i) => !i.isLoaner)
    );
  }

  const total = transactions.length;
  const pageLimit = Math.min(filters.limit ?? 200, 1000);
  const offset = filters.offset ?? 0;
  return { transactions: transactions.slice(offset, offset + pageLimit), total };
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const snap = await adminDb().collection('transactions').doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Transaction) : null;
}

export async function findTransactionByLocalId(localId: string): Promise<Transaction | null> {
  const snap = await adminDb()
    .collection('transactions')
    .where('localId', '==', localId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Transaction;
}

export async function createTransaction(tx: Transaction): Promise<Transaction> {
  const batch = adminDb().batch();

  batch.set(adminDb().collection('transactions').doc(tx.id), { ...tx, syncStatus: 'synced' });

  for (const item of tx.items) {
    const invRef = adminDb()
      .collection('events').doc(tx.eventId).collection('inventory').doc(item.partId);
    batch.update(invRef, { quantityGiven: FieldValue.increment(item.quantity) });
  }

  await batch.commit();
  return { ...tx, syncStatus: 'synced' };
}

export async function updateTransactionLoaner(
  id: string,
  opts: { itemIndex?: number; allReturned?: boolean }
): Promise<void> {
  const tx = await getTransaction(id);
  if (!tx) throw new Error('Transaction not found');

  const now = new Date().toISOString();
  const items = tx.items.map((item, idx) => {
    if (opts.allReturned || idx === opts.itemIndex) {
      return { ...item, loanerReturned: true, loanerReturnedAt: now };
    }
    return item;
  });

  await adminDb().collection('transactions').doc(id).update({ items });
}

// ─── Parts (global catalog) ───────────────────────────────────────────────────

export async function getParts(filters: { category?: string; search?: string } = {}): Promise<Part[]> {
  const snap = await adminDb().collection('parts').get();
  let parts = snap.docs.map((d) => d.data() as Part);

  if (filters.category) {
    parts = parts.filter((p) => p.category === filters.category);
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    parts = parts.filter(
      (p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)
    );
  }
  return parts;
}

export async function upsertPart(part: Part): Promise<void> {
  await adminDb().collection('parts').doc(part.id).set(part);
}

export async function getPartBySku(sku: string): Promise<Part | null> {
  const snap = await adminDb()
    .collection('parts')
    .where('sku', '==', sku)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as Part;
}

// ─── App Settings (API keys stored server-side in Firestore) ─────────────────

export interface AppSettings {
  firstApiKey?: string;          // base64(username:authToken) for FIRST FRC API
  firstFtcApiKey?: string;       // base64(username:authToken) for FIRST FTC API
  bigcommerceStoreHash?: string; // store hash for BigCommerce REST API
  bigcommerceApiToken?: string;  // X-Auth-Token for BigCommerce REST API
}

export async function getSettings(): Promise<AppSettings> {
  const snap = await adminDb().collection('config').doc('settings').get();
  return snap.exists ? (snap.data() as AppSettings) : {};
}

export async function updateSettings(data: Partial<AppSettings>): Promise<void> {
  await adminDb().collection('config').doc('settings').set(data, { merge: true });
}

// ─── Admin Logs ───────────────────────────────────────────────────────────────

export async function createAdminLog(log: Omit<AdminLog, 'id'>): Promise<void> {
  const id = generateId();
  await adminDb().collection('adminLogs').doc(id).set({ ...log, id });
}

export async function getAdminLogs(eventId?: string): Promise<AdminLog[]> {
  let q = adminDb().collection('adminLogs').orderBy('timestamp', 'desc').limit(100) as FirebaseFirestore.Query;
  // Note: filtering by eventId after orderBy requires a composite index.
  // Apply eventId filter without orderBy to avoid the index requirement, then sort in memory.
  if (eventId) {
    const snap = await adminDb()
      .collection('adminLogs')
      .where('eventId', '==', eventId)
      .limit(100)
      .get();
    const logs = snap.docs.map((d) => d.data() as AdminLog);
    logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return logs;
  }
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as AdminLog);
}

// ─── Event clone ──────────────────────────────────────────────────────────────

export async function cloneEventInventory(
  sourceEventId: string,
  targetEventId: string
): Promise<number> {
  const inventory = await getInventory(sourceEventId);
  const batch = adminDb().batch();

  for (const item of inventory) {
    const newItem: InventoryItem = { ...item, eventId: targetEventId, quantityGiven: 0 };
    batch.set(
      adminDb().collection('events').doc(targetEventId).collection('inventory').doc(newItem.id),
      newItem
    );
  }

  await batch.commit();
  return inventory.length;
}

// ─── Inventory snapshot ───────────────────────────────────────────────────────

export async function saveInventorySnapshot(eventId: string): Promise<void> {
  const inventory = await getInventory(eventId);
  await adminDb()
    .collection('events').doc(eventId).collection('snapshots').doc('final')
    .set({ inventory, savedAt: new Date().toISOString() });
}
