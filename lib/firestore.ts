import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  writeBatch,
  increment,
  DocumentSnapshot,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase-client';
import type { RevEvent, InventoryItem, Team, Transaction, Part, AdminLog } from './types';
import { generateId } from './utils';

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvents(filters: { status?: string; program?: string } = {}): Promise<RevEvent[]> {
  const constraints: QueryConstraint[] = [orderBy('startDate', 'desc')];
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.program) constraints.push(where('program', '==', filters.program));
  const snap = await getDocs(query(collection(db, 'events'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RevEvent));
}

export async function getEvent(id: string): Promise<RevEvent | null> {
  const snap = await getDoc(doc(db, 'events', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as RevEvent) : null;
}

export async function createEvent(data: Omit<RevEvent, 'id' | 'createdAt'>): Promise<RevEvent> {
  const id = generateId();
  const event: RevEvent = { ...data, id, createdAt: new Date().toISOString() };
  await setDoc(doc(db, 'events', id), event);
  return event;
}

export async function updateEvent(id: string, data: Partial<RevEvent>): Promise<void> {
  await updateDoc(doc(db, 'events', id), data as Record<string, unknown>);
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'events', id));
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getInventory(eventId: string): Promise<InventoryItem[]> {
  const snap = await getDocs(
    query(
      collection(db, 'events', eventId, 'inventory'),
      orderBy('part.category'),
      orderBy('part.name')
    )
  );
  return snap.docs.map((d) => d.data() as InventoryItem);
}

export async function upsertInventoryItem(eventId: string, item: InventoryItem): Promise<void> {
  await setDoc(doc(db, 'events', eventId, 'inventory', item.id), { ...item, eventId });
}

export async function updateInventoryItem(
  eventId: string,
  itemId: string,
  data: Partial<InventoryItem>
): Promise<void> {
  await updateDoc(doc(db, 'events', eventId, 'inventory', itemId), data as Record<string, unknown>);
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function getTeams(eventId: string): Promise<Team[]> {
  const snap = await getDocs(
    query(collection(db, 'events', eventId, 'teams'), orderBy('teamNumber'))
  );
  return snap.docs.map((d) => d.data() as Team);
}

export async function upsertTeam(eventId: string, team: Team): Promise<void> {
  await setDoc(doc(db, 'events', eventId, 'teams', team.id), team);
}

export async function deleteTeam(eventId: string, teamId: string): Promise<void> {
  await deleteDoc(doc(db, 'events', eventId, 'teams', teamId));
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
  const constraints: QueryConstraint[] = [];

  if (filters.eventId) constraints.push(where('eventId', '==', filters.eventId));
  if (filters.staffEmail) constraints.push(where('staffEmail', '==', filters.staffEmail));
  if (filters.teamNumber) constraints.push(where('teamNumber', '==', filters.teamNumber));
  constraints.push(orderBy('timestamp', 'desc'));

  const snap = await getDocs(query(collection(db, 'transactions'), ...constraints));
  let transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));

  // Client-side filter for fields that can't be combined in Firestore without composite indexes
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
  const snap = await getDoc(doc(db, 'transactions', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Transaction) : null;
}

export async function findTransactionByLocalId(localId: string): Promise<Transaction | null> {
  const snap = await getDocs(
    query(collection(db, 'transactions'), where('localId', '==', localId), firestoreLimit(1))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Transaction;
}

export async function createTransaction(tx: Transaction): Promise<Transaction> {
  const batch = writeBatch(db);

  // Save transaction
  batch.set(doc(db, 'transactions', tx.id), { ...tx, syncStatus: 'synced' });

  // Atomically increment quantityGiven for each item
  for (const item of tx.items) {
    const invRef = doc(db, 'events', tx.eventId, 'inventory', item.partId);
    batch.update(invRef, { quantityGiven: increment(item.quantity) });
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

  await updateDoc(doc(db, 'transactions', id), { items });
}

// ─── Parts (global catalog) ───────────────────────────────────────────────────

export async function getParts(filters: { category?: string; search?: string } = {}): Promise<Part[]> {
  const snap = await getDocs(collection(db, 'parts'));
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
  await setDoc(doc(db, 'parts', part.id), part);
}

export async function getPartBySku(sku: string): Promise<Part | null> {
  const snap = await getDocs(
    query(collection(db, 'parts'), where('sku', '==', sku), firestoreLimit(1))
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as Part;
}

// ─── Admin Logs ───────────────────────────────────────────────────────────────

export async function createAdminLog(log: Omit<AdminLog, 'id'>): Promise<void> {
  const id = generateId();
  await setDoc(doc(db, 'adminLogs', id), { ...log, id });
}

export async function getAdminLogs(eventId?: string): Promise<AdminLog[]> {
  const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc'), firestoreLimit(100)];
  if (eventId) constraints.push(where('eventId', '==', eventId));
  const snap = await getDocs(query(collection(db, 'adminLogs'), ...constraints));
  return snap.docs.map((d) => d.data() as AdminLog);
}

// ─── Event clone ──────────────────────────────────────────────────────────────

export async function cloneEventInventory(
  sourceEventId: string,
  targetEventId: string
): Promise<number> {
  const inventory = await getInventory(sourceEventId);
  const batch = writeBatch(db);

  for (const item of inventory) {
    const newItem: InventoryItem = {
      ...item,
      eventId: targetEventId,
      quantityGiven: 0,
    };
    batch.set(doc(db, 'events', targetEventId, 'inventory', newItem.id), newItem);
  }

  await batch.commit();
  return inventory.length;
}

// ─── Inventory snapshot ───────────────────────────────────────────────────────

export async function saveInventorySnapshot(eventId: string): Promise<void> {
  const inventory = await getInventory(eventId);
  await setDoc(doc(db, 'events', eventId, 'snapshots', 'final'), {
    inventory,
    savedAt: new Date().toISOString(),
  });
}
