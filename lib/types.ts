// REV Parts Pit — All TypeScript Interfaces

export type Program = 'FRC' | 'FTC' | 'FLL' | 'OTHER';
export type EventStatus = 'setup' | 'active' | 'closed';
export type UnitType = 'each' | 'pack';
export type SyncStatus = 'synced' | 'pending' | 'failed';
export type PartCondition = 'new' | 'used' | 'damaged';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RevUser {
  uid: string;
  email: string;
  name: string;
  photoUrl?: string;
  isAdmin: boolean;
  idToken: string;
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface RevEvent {
  id: string;
  name: string;
  program: Program;
  location: string;
  startDate: string; // ISO date
  endDate: string;
  status: EventStatus;
  firstEventCode?: string;
  firstSeason?: number;
  createdBy: string;
  createdAt: string;
  notes?: string;
}

// ─── Part (global catalog) ───────────────────────────────────────────────────

export interface Part {
  id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  imageUrl?: string;
  packSize: number;
  packUnit?: string;
  defaultLoaner: boolean;
  msrp?: number;
  weight?: number;
  tags?: string[];
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string; // = part.id
  eventId: string;
  part: Part;
  quantityAvailable: number;
  quantityGiven: number;
  isLoaner: boolean;
  lowStockThreshold?: number;
  notes?: string;
}

// ─── Team ────────────────────────────────────────────────────────────────────

export interface Team {
  id: string; // "{eventId}_{teamNumber}"
  eventId: string;
  teamNumber: string | number;
  teamName: string;
  program: Program;
  city?: string;
  state?: string;
  country?: string;
  school?: string;
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export interface TransactionItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number; // always individual units
  unitType: UnitType;
  isLoaner: boolean;
  loanerReturned?: boolean;
  loanerReturnedAt?: string;
  condition?: PartCondition;
}

export interface Transaction {
  id: string;
  localId?: string;
  eventId: string;
  eventName: string;
  teamNumber: string | number;
  teamName: string;
  contactName: string;
  contactEmail: string;
  reason?: string;
  staffEmail: string;
  staffName: string;
  staffPhotoUrl?: string;
  items: TransactionItem[];
  totalItems: number;
  timestamp: string;
  syncStatus: SyncStatus;
  notes?: string;
}

// ─── Cart (client-side only) ─────────────────────────────────────────────────

export interface CartItem {
  part: Part;
  inventoryItem: InventoryItem;
  quantity: number;
  unitType: UnitType;
  isLoaner: boolean;
  condition?: PartCondition;
}

// ─── FIRST API types ──────────────────────────────────────────────────────────

export interface FirstEvent {
  code: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  stateprov?: string;
  country?: string;
  city?: string;
  venue?: string;
  season: number;
  program: 'FRC' | 'FTC';
}

export interface FirstTeam {
  teamNumber: number | string;
  nameShort: string;
  nameFull?: string;
  city?: string;
  stateProv?: string;
  country?: string;
  schoolName?: string;
}

// ─── Offline (IndexedDB via Dexie) ───────────────────────────────────────────

export interface PendingTransaction extends Transaction {
  retryCount: number;
  createdLocally: string;
}

export interface CachedEvent {
  id: string;
  data: RevEvent[];
  cachedAt: number;
}

export interface CachedInventory {
  eventId: string;
  data: InventoryItem[];
  cachedAt: number;
}

export interface CachedTeams {
  eventId: string;
  data: Team[];
  cachedAt: number;
}

// ─── Admin Log ───────────────────────────────────────────────────────────────

export interface AdminLog {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  details?: Record<string, unknown>;
  eventId?: string;
}

// ─── BigCommerce types ────────────────────────────────────────────────────────

export interface BigCommerceProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  categories: number[];
  primary_image?: { url_thumbnail: string };
  description?: string;
  variants?: BigCommerceVariant[];
}

export interface BigCommerceVariant {
  id: number;
  sku: string;
  price: number;
  weight?: number;
}

export interface BigCommerceCategory {
  id: number;
  name: string;
  parent_id: number;
}
