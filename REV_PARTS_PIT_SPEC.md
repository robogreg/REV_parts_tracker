# REV Parts Pit — Complete Technical Specification

> **Purpose:** This document is a complete, self-contained specification for building the REV Parts Pit event parts distribution system. It is intended to be given directly to an AI coding assistant to implement from scratch. Every section should be treated as a requirement unless explicitly marked optional.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Data Models](#4-data-models)
5. [Authentication](#5-authentication)
6. [Frontend — Checkout Interface](#6-frontend--checkout-interface)
7. [Frontend — Admin Interface](#7-frontend--admin-interface)
8. [API Routes](#8-api-routes)
9. [Integrations](#9-integrations)
10. [Offline Support](#10-offline-support)
11. [Deployment — Google Cloud](#11-deployment--google-cloud)
12. [Environment Variables](#12-environment-variables)
13. [Suggested Enhancements](#13-suggested-enhancements)
14. [CSV Formats](#14-csv-formats)
15. [PWA Manifest](#15-pwa-manifest)

---

## 1. Project Overview

**Name:** REV Parts Pit

**What it does:** A mobile-first web application used at robotics events (FRC, FTC, FLL) to manage and distribute spare parts to competing teams. REV Robotics staff use it to log what parts were given to which teams, with full audit capabilities after the event.

**Two audiences:**

- **Staff (checkout view):** Any REV employee with a `@revrobotics.com` Google account. Uses a tablet or phone in the pit area to give out parts and log transactions. Must work offline if the venue WiFi dies.
- **Admins:** A subset of staff who can create/manage events, upload inventory and team lists, view dashboards, and export data.

**Core workflow:**
1. Admin creates an event and loads inventory (via CSV or REV API or manual entry) and team list (via CSV, FIRST API, or manual entry).
2. Staff arrive at an event, select the active event on their device.
3. A team walks up to the parts pit. Staff finds the parts in the catalog, adds them to a cart (marking loaner vs. keep), enters the team number and a contact name/email, optionally a reason, and checks out.
4. The transaction is saved to Firestore. If offline, it goes to IndexedDB and syncs when connection returns.
5. After the event, admin views a dashboard showing all transactions, filters by team or staff member, and can export a CSV audit log.

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | Full-stack in one repo, easy Cloud Run deploy |
| Language | **TypeScript** | Type safety across frontend and backend |
| Styling | **Tailwind CSS** | Rapid mobile-first UI |
| Database | **Google Cloud Firestore** | REV already uses it; offline SDK support |
| Auth | **Firebase Authentication** | Google OAuth with domain restriction |
| Offline | **Dexie.js** (IndexedDB) | Clean API for offline transaction queue |
| PWA | **next-pwa** | Service worker generation, installable app |
| State | **Zustand** | Lightweight cart + app state, persistent |
| Data fetching | **TanStack Query v5** | Caching, background refresh, loading states |
| File storage | **Google Cloud Storage** | CSV uploads, part images |
| Deployment | **Google Cloud Run** | Containerized, scales to zero |
| CI/CD | **Cloud Build** | Auto-deploy on push to main |

**Do not use:** Redux, Next.js Pages Router, REST frameworks like Express (use Next.js API routes instead), any SQL database.

---

## 3. Project Structure

```
rev-parts-pit/
├── app/
│   ├── layout.tsx                    # Root layout, fonts, AuthProvider, Toaster
│   ├── globals.css                   # Tailwind directives + CSS variables + base styles
│   ├── page.tsx                      # Redirects to /checkout if authed, /login if not
│   │
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Google sign-in page
│   │
│   ├── (app)/
│   │   ├── layout.tsx                # App shell with auth guard
│   │   ├── checkout/
│   │   │   └── page.tsx              # Main POS interface
│   │   └── admin/
│   │       ├── layout.tsx            # Admin layout with sidebar nav
│   │       ├── page.tsx              # Dashboard overview
│   │       ├── events/
│   │       │   ├── page.tsx          # Events list
│   │       │   ├── new/page.tsx      # Create event
│   │       │   └── [id]/
│   │       │       ├── page.tsx      # Event detail (tabs: Inventory, Teams, Settings)
│   │       │       ├── inventory/page.tsx
│   │       │       └── teams/page.tsx
│   │       └── reports/
│   │           └── page.tsx          # Transaction audit / export
│   │
│   └── api/
│       ├── auth/verify/route.ts      # Verify Firebase ID token (server-side)
│       ├── events/
│       │   ├── route.ts              # GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts          # GET, PATCH, DELETE
│       │       ├── inventory/
│       │       │   ├── route.ts      # GET list, POST single item
│       │       │   ├── csv/route.ts  # POST CSV upload → bulk create
│       │       │   └── rev/route.ts  # POST → fetch from REV BigCommerce API
│       │       └── teams/
│       │           ├── route.ts      # GET list, POST single team
│       │           ├── csv/route.ts  # POST CSV upload → bulk create
│       │           └── first/route.ts # POST { program, season, eventCode } → import teams
│       ├── transactions/
│       │   ├── route.ts              # GET list (with filters), POST create
│       │   ├── sync/route.ts         # POST bulk sync from offline queue
│       │   └── [id]/route.ts         # GET single, PATCH (loaner return)
│       ├── first/
│       │   ├── events/route.ts       # GET FIRST events list (FRC or FTC)
│       │   └── teams/route.ts        # GET teams for a specific FIRST event
│       └── parts/
│           └── route.ts              # GET global parts catalog
│
├── components/
│   ├── auth/
│   │   └── AuthProvider.tsx          # Firebase auth context
│   ├── checkout/
│   │   ├── PartsGrid.tsx             # Scrollable grid of inventory cards
│   │   ├── PartCard.tsx              # Individual part card with qty controls
│   │   ├── CartPanel.tsx             # Slide-in cart sidebar
│   │   ├── CartItem.tsx              # Cart row with loaner toggle
│   │   ├── CheckoutModal.tsx         # Team/contact form + confirm
│   │   ├── EventSwitcher.tsx         # Bottom sheet to pick active event
│   │   ├── CategoryFilter.tsx        # Horizontal chip filter bar
│   │   └── TeamSearch.tsx            # Searchable team dropdown
│   ├── admin/
│   │   ├── EventCard.tsx
│   │   ├── InventoryTable.tsx
│   │   ├── TransactionTable.tsx
│   │   ├── StatsCards.tsx
│   │   ├── CsvUploader.tsx
│   │   ├── FirstImporter.tsx         # FIRST API import UI
│   │   ├── RevImporter.tsx           # REV products import UI
│   │   └── LoanerReturnModal.tsx
│   └── ui/
│       ├── OnlineDetector.tsx        # Sets isOnline in store, shows sync banner
│       ├── SyncBanner.tsx            # "X items pending sync" banner
│       ├── QuantityControl.tsx       # +/- stepper
│       ├── Badge.tsx
│       ├── Modal.tsx
│       ├── BottomSheet.tsx
│       ├── Spinner.tsx
│       └── EmptyState.tsx
│
├── hooks/
│   ├── useInventory.ts               # Fetch + cache inventory for an event
│   ├── useTeams.ts                   # Fetch + cache teams for an event
│   ├── useTransactions.ts            # Fetch transactions with filters
│   ├── useEvents.ts                  # Fetch all events
│   └── useOnline.ts                  # Navigator.onLine + event listener
│
├── lib/
│   ├── types.ts                      # ALL TypeScript interfaces (see §4)
│   ├── firebase-client.ts            # Firebase app, auth, db, storage (client)
│   ├── firebase-admin.ts             # Firebase Admin SDK (server only)
│   ├── firestore.ts                  # All Firestore read/write helpers
│   ├── store.ts                      # Zustand stores (cart + app state)
│   ├── offline.ts                    # Dexie DB, cache helpers, sync engine
│   ├── first-api.ts                  # FIRST FRC/FTC API client
│   ├── rev-api.ts                    # REV BigCommerce API client
│   ├── csv-parser.ts                 # Parse inventory and teams CSVs
│   └── utils.ts                      # cn(), formatDate(), generateId(), etc.
│
├── public/
│   ├── manifest.json
│   ├── icons/                        # PWA icons (192, 512)
│   └── sw.js                         # Generated by next-pwa
│
├── Dockerfile
├── .dockerignore
├── cloudbuild.yaml
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── .env.example
```

---

## 4. Data Models

All TypeScript interfaces live in `lib/types.ts`. Firestore collections mirror these structures.

### 4.1 Core Types

```typescript
export type Program = 'FRC' | 'FTC' | 'FLL' | 'OTHER';
export type EventStatus = 'setup' | 'active' | 'closed';
export type UnitType = 'each' | 'pack';
export type SyncStatus = 'synced' | 'pending' | 'failed';
```

### 4.2 RevEvent

**Firestore path:** `events/{eventId}`

```typescript
interface RevEvent {
  id: string;
  name: string;                   // "2025 Houston Championship"
  program: Program;
  location: string;               // "George R. Brown Convention Center, Houston TX"
  startDate: string;              // ISO date "2025-04-16"
  endDate: string;
  status: EventStatus;
  firstEventCode?: string;        // "2025TXHOU" — links to FIRST API event
  firstSeason?: number;           // 2025
  createdBy: string;              // staff email
  createdAt: string;
  notes?: string;
}
```

### 4.3 Part (global catalog)

**Firestore path:** `parts/{partId}`

Parts are global across events. An event's inventory references these parts.

```typescript
interface Part {
  id: string;                     // REV SKU or generated UUID
  name: string;                   // "NEO Brushless Motor V1.1"
  sku: string;                    // "REV-21-1650"
  category: string;               // "Motors", "Electronics", "Hardware", "Pneumatics"
  description?: string;
  imageUrl?: string;              // CDN URL
  packSize: number;               // Individual units per pack. 1 = no pack concept.
  packUnit?: string;              // Human label e.g. "bag of 50", "2-pack"
  defaultLoaner: boolean;         // Suggested default for this part type
  msrp?: number;                  // Retail price (for reporting)
  weight?: number;                // Grams per individual unit
  tags?: string[];                // Searchable tags
}
```

### 4.4 InventoryItem

**Firestore path:** `events/{eventId}/inventory/{partId}`

The `id` field matches the part's `id` for easy lookup.

```typescript
interface InventoryItem {
  id: string;                       // = part.id
  eventId: string;
  part: Part;                       // Denormalized — embed the full part
  quantityAvailable: number;        // Total INDIVIDUAL units available at event start
  quantityGiven: number;            // Total individual units given out so far
  isLoaner: boolean;                // Event-level override of part.defaultLoaner
  lowStockThreshold?: number;       // Warn when (available - given) <= this
  notes?: string;                   // Admin note e.g. "limited supply"
}
```

**Computed:** `remaining = quantityAvailable - quantityGiven`

### 4.5 Team

**Firestore path:** `events/{eventId}/teams/{teamId}`

```typescript
interface Team {
  id: string;                     // "{eventId}_{teamNumber}"
  eventId: string;
  teamNumber: string | number;    // FRC: numeric, FTC: alphanumeric
  teamName: string;
  program: Program;
  city?: string;
  state?: string;
  country?: string;
  school?: string;
}
```

### 4.6 Transaction

**Firestore path:** `transactions/{transactionId}`

Transactions are stored at the root level (not nested under events) to allow cross-event queries.

```typescript
interface TransactionItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;               // Individual units (always)
  unitType: UnitType;             // How it was dispensed (each or full pack)
  isLoaner: boolean;
  loanerReturned?: boolean;
  loanerReturnedAt?: string;
}

interface Transaction {
  id: string;
  localId?: string;               // Set when created offline, used for dedup on sync
  eventId: string;
  eventName: string;              // Denormalized for easy display
  teamNumber: string | number;
  teamName: string;               // Denormalized
  contactName: string;            // Required
  contactEmail: string;           // Required
  reason?: string;                // Optional "why"
  staffEmail: string;
  staffName: string;
  staffPhotoUrl?: string;
  items: TransactionItem[];
  totalItems: number;             // Sum of all item.quantity (individual units)
  timestamp: string;              // ISO datetime
  syncStatus: SyncStatus;
  notes?: string;
}
```

### 4.7 CartItem (client-side only, not persisted in Firestore)

```typescript
interface CartItem {
  part: Part;
  inventoryItem: InventoryItem;
  quantity: number;               // Number of units being added
  unitType: UnitType;             // 'each' or 'pack'
  isLoaner: boolean;
}
```

---

## 5. Authentication

### 5.1 Google OAuth via Firebase Auth

- Use `GoogleAuthProvider` with `hd: 'revrobotics.com'` to restrict sign-in to REV Google Workspace accounts.
- On the server side (`firebase-admin.ts`), verify every API request with `adminAuth().verifyIdToken(token)` and confirm `email.endsWith('@revrobotics.com')`.
- The Firebase ID token must be sent in every API request as `Authorization: Bearer {idToken}`.

### 5.2 Admin role

Admin is not stored in Firestore — it is determined by an environment variable:

```
NEXT_PUBLIC_ADMIN_EMAILS=greg@revrobotics.com,admin@revrobotics.com
```

Any email in this comma-separated list gets `isAdmin: true` in the `RevUser` object. Admin-only routes and UI elements check `user.isAdmin`.

### 5.3 Auth flow

1. User visits `/` → redirected to `/checkout` if signed in, `/login` if not.
2. Login page shows a single "Sign in with Google" button.
3. Firebase handles the popup. On success, `AuthProvider` catches `onAuthStateChanged`, creates a `RevUser`, and saves to Zustand store.
4. If the signed-in email does NOT end with `@revrobotics.com`, the user is immediately signed out.
5. All `(app)/` routes have a layout-level auth guard that redirects to `/login` if `user` is null.

### 5.4 Token refresh

TanStack Query hooks should include the current Firebase ID token in every request. Use a helper:

```typescript
async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
```

---

## 6. Frontend — Checkout Interface

This is the primary screen. It must work excellently on a tablet (landscape or portrait) and a phone (portrait). Touch targets must be at least 44×44px.

### 6.1 Visual Design

**Theme:** Dark mode only. REV brand colors: `#FF6B00` (orange), `#0F0F0F` (dark bg), `#1A1A1A` (surface), `#F5F5F5` (text). High contrast for use in gym and arena lighting.

**Fonts:** Use Google Fonts. Display/headings: `Barlow Condensed` (bold, uppercase). Body/labels: `Inter`. Load via `next/font/google`.

**Layout:** Three-zone layout on tablet landscape:
- Left/main zone: Scrollable parts grid
- Right zone: Cart panel (slides in from right on mobile, always visible on tablet landscape ≥1024px)
- Top: Fixed header with event switcher and search

### 6.2 Header

Fixed to top. Contains (left to right):
- REV Parts Pit logo (small, orange square icon + text)
- **Event switcher button** (takes up most of the width): Shows current event name and program. Tapping opens the EventSwitcher bottom sheet. If no event is selected, shows "Select Event" with a pulsing orange border.
- Online/offline indicator pill (green WiFi icon when online, amber WifiOff when offline; shows pending count badge when >0)
- User avatar (circular photo from Google account)
- Admin gear icon (only shown if `user.isAdmin`)

Below the header:
- Search bar (full width, with magnifier icon)
- Category filter chips (horizontal scrollable row)

### 6.3 Parts Grid

- **Card layout:** 2 columns on phone, 3 columns on tablet portrait, 4 columns on tablet landscape
- Each `PartCard` shows:
  - Part image (with fallback to a REV-orange placeholder with category icon)
  - Part name (bold, 2 lines max then truncate)
  - SKU (monospace, small, gray)
  - Stock remaining badge (green if >10, yellow if 1–10, red if 0, gray if no limit set)
  - Pack info if applicable: "Bag of 50 · $2.49 each" (optional)
  - A loaner badge if `isLoaner` is true for this event
  - Quantity stepper when in cart: shows `-`, current qty, `+`
  - "Add" button when not in cart
  - Low-stock warning icon when remaining ≤ `lowStockThreshold`
  - Out-of-stock items appear grayed out with "Out" label, but can still be added (staff can override)

**Quantity stepper behavior:**
- For items with `packSize > 1`: Show two buttons — "Add 1" and "Add Pack (N)". Tapping either opens a small popover: choose unit type (each vs. pack) and quantity.
- For items with `packSize = 1`: Single "Add" button, tapping increments cart qty.
- Long-press on "Add" opens the quantity popover.

**Loaner toggle:** Each card in the grid has a small toggle (lock icon) to mark that specific dispensing as a loaner. Default comes from `inventoryItem.isLoaner`.

### 6.4 Cart Panel

On phone: Opens as a right-side drawer (full height, slides in from right). Cart icon in top-right of screen shows item count badge.

On tablet landscape (≥1024px): Always visible on the right side (320px wide), fixed.

Cart panel contents:
- Header: "Cart (N items)" with X close button (mobile only)
- Scrollable list of `CartItem` rows
- Each row shows: part name, SKU, quantity (editable stepper), unit type badge ("each" / "pack"), loaner toggle, remove button
- If a part has `packSize > 1`, the row shows both the pack count AND the individual unit total: "2 packs (100 units)"
- Subtotal: "N unique parts · N total units"
- Prominent "Check Out" button (disabled if cart is empty)
- A "Loaner Summary" section at the bottom if any items are marked loaner: "3 loaner items — remind team to return"
- "Clear Cart" secondary button

### 6.5 Checkout Modal

Full-screen modal (bottom sheet on mobile, centered modal on tablet). Opens when staff taps "Check Out".

**Form fields:**

1. **Team** (required): Searchable dropdown. Shows team number + name. If teams have been loaded for the event, search filters the list. If no teams loaded, shows a free-text input.
   - Search should work by team number (numeric prefix match) OR team name (fuzzy)
   - Show team city/state next to name
   
2. **Contact Name** (required): Free text.

3. **Contact Email** (required): Email validation.

4. **Reason** (optional): Free text, max 200 chars. Placeholder: "Why are these parts being given? (optional)"

5. **Cart summary:** Read-only list of items being given. Each item shows loaner badge if applicable.

6. **Confirm button:** "Give Parts to Team N" (orange, full width). Shows spinner while submitting.

On confirm:
- Validate all required fields
- Build a `Transaction` object
- If online: POST to `/api/transactions`, show success toast, clear cart, dismiss modal
- If offline: Save to IndexedDB via `savePendingTransaction()`, show amber "Saved offline — will sync when connected" toast, clear cart, dismiss modal
- On success (either path): Show a success screen briefly before returning to parts grid

**Error handling:** Show inline field errors. On API failure, show a toast and keep the modal open so the user doesn't lose their data.

### 6.6 Event Switcher

Opens as a bottom sheet (full-width, 60% screen height).

Shows:
- List of active events (status = 'active') at top
- Then setup events
- Each event card shows: name, program badge, date, location, number of parts loaded
- Currently selected event has an orange checkmark
- "Admin: Create Event" link at the bottom (admin only)
- Loading skeleton while fetching

Selecting an event:
- Sets `activeEvent` in Zustand store (persisted)
- Clears the cart (with a warning if cart is not empty: "Switching events will clear your cart. Continue?")
- Closes the bottom sheet
- Triggers a refetch of inventory and teams for that event

### 6.7 Category Filter

Horizontal scrollable chip row below the header. Shows all unique categories found in the event's inventory. An "All" chip is always first. Selected category shows orange background. Tapping a selected chip deselects it (shows All).

### 6.8 Offline UX

When `isOnline = false`:
- Show a persistent amber banner at the top of the checkout screen: "⚠ Offline — transactions will be saved and synced when connected"
- The checkout flow still works normally (saves to IndexedDB)
- When connection returns, the `OnlineDetector` fires the sync, and a toast shows: "✓ Synced N transactions"
- Pending transaction count is shown in the header status pill

---

## 7. Frontend — Admin Interface

Admin section at `/admin`. Only accessible if `user.isAdmin`. Non-admin users attempting to access `/admin` are redirected to `/checkout`.

### 7.1 Admin Layout

Persistent left sidebar on desktop, bottom tab bar on mobile. Navigation items:
- Dashboard (overview stats)
- Events (list + create)
- Reports (transaction audit)

### 7.2 Dashboard Page (`/admin`)

Shows a summary across all events or filtered to a selected event (dropdown selector).

**Stats cards:**
- Total transactions (current event)
- Total individual units given out
- Total loaner items
- Unique teams served
- Unique staff members

**Charts (use Recharts):**
- Bar chart: Top 10 parts given out (by unit count)
- Bar chart: Top 10 teams by items received
- Line chart: Transactions over time (by day/hour)

**Recent transactions table:** Last 20 transactions with columns: Time, Staff, Team, Items, Loaner

### 7.3 Events List (`/admin/events`)

Table of all events. Columns: Name, Program, Dates, Location, Status (badge), Parts Loaded, Teams Loaded, Actions.

Actions per row:
- Edit
- View inventory
- View teams
- Clone event (copies inventory setup to a new event, prompts for new name/dates)
- Change status (setup → active → closed)
- Delete (requires confirmation; only if 0 transactions)

"Create Event" button top-right.

### 7.4 Create Event Form (`/admin/events/new`)

Fields:
- Event Name (required)
- Program: FRC / FTC / FLL / Other (radio or select)
- Start Date, End Date
- Location/Venue
- FIRST Event Code (optional): Text input OR a "Browse FIRST Events" button that opens the FIRST event importer
- Notes

The "Browse FIRST Events" modal:
- Select program (FRC or FTC)
- Select season year (default: current year)
- Fetches event list from `/api/first/events?program=FRC&season=2025`
- Shows searchable list of events with dates and location
- Selecting one auto-fills the event code, name, dates, and location on the form
- Alternatively, paste a FIRST event URL directly and parse it

On save → creates event with status 'setup', redirects to `/admin/events/{id}`.

### 7.5 Event Detail Page (`/admin/events/[id]`)

Three tabs: **Inventory**, **Teams**, **Settings**

#### Inventory Tab

Top section: Stats bar showing total SKUs, total units available, units given out, units remaining.

Inventory table:
- Columns: Image (small), Name, SKU, Category, Pack Size, Available, Given, Remaining, Stock %, Loaner, Low Stock Threshold, Actions
- Inline edit for: Available qty, Loaner toggle, Low stock threshold
- Sort by any column
- Filter by category or search by name/SKU
- Row highlight: Red if remaining = 0, yellow if ≤ threshold

**Import buttons (top right):**

1. **Upload CSV** — opens a file picker. Accepts CSV in the format specified in §14. Shows a preview table with first 5 rows and a count, then a "Import N parts" confirm button. Reports errors per row (bad format, missing required fields).

2. **Import from REV Site** — calls `/api/events/{id}/inventory/rev`. Options:
   - "Add all REV products" (full catalog)
   - "Select categories" (checkboxes of product categories)
   - After selection, shows a count and confirm button. Sets initial `quantityAvailable = 0` for all; admin must then edit quantities.

3. **Add single part** — modal form: SKU lookup (fetches from parts catalog or REV API), then set qty, loaner default, threshold.

**Export inventory CSV button** — downloads current state (useful for post-event auditing).

#### Teams Tab

Teams table. Columns: Program, Number, Name, City, State/Country, Actions (remove).

**Import buttons:**

1. **Upload CSV** — see §14 for format.

2. **Import from FIRST API** — if the event has a `firstEventCode`, a button "Sync Teams from FIRST" is shown. Clicking calls `/api/events/{id}/teams/first` which fetches the team list from FIRST API and upserts. Shows a diff: "Added N teams, updated N teams, no changes to N teams".

3. **Paste FIRST URL** — text input where admin can paste a URL like `https://frc-events.firstinspires.org/2025/TXHOU`. The API parses it, fetches teams, and imports. Works for both FRC and FTC URLs.

4. **Add single team** — modal form: Team number, name, city, state, program.

#### Settings Tab

- Edit event name, dates, location, notes, program
- Change status (with confirmation if changing to 'closed' when transactions exist)
- **Danger zone:** Delete event (requires typing event name to confirm; disabled if any transactions exist)

### 7.6 Reports Page (`/admin/reports`)

**Filters bar:**
- Event selector (dropdown, defaults to most recent active event)
- Date range (start/end datetime pickers)
- Staff email (dropdown of all staff who gave parts)
- Team number (free text search)
- Part name (free text search)
- Loaner filter: All / Loaner only / Non-loaner only

**Results table** (paginated, 50 rows per page):
Columns: Timestamp, Staff Name, Team #, Team Name, Contact, Part Name, SKU, Qty, Unit Type, Loaner, Reason, Transaction ID

Click a row to expand and see the full transaction (all items in that transaction).

**Summary bar above table:** "Showing N transactions / N total units / $X MSRP value"

**Export buttons:**
- "Export CSV (Audit Log)" — downloads all matching rows as a flat CSV (one row per item, not per transaction)
- "Export CSV (Transactions)" — one row per transaction with items as a comma-separated sub-list

**Loaners section** (collapsible panel at bottom of page):
Table of all unreturned loaner items. Columns: Team, Contact Email, Part, Qty, Given At, Staff.
"Mark Returned" button per row (opens a confirmation modal).

---

## 8. API Routes

All routes are Next.js Route Handlers in `app/api/`. All non-public routes require a valid Firebase ID token from a `@revrobotics.com` account.

### Auth middleware helper

Create a `lib/api-helpers.ts` with a `requireAuth(request)` function that:
1. Reads `Authorization: Bearer {token}` header
2. Calls `adminAuth().verifyIdToken(token)`
3. Checks email domain
4. Returns `{ uid, email, name }` or throws a 401 Response

Use this at the top of every route handler.

---

### `GET /api/events`

Returns all events ordered by `startDate` desc.

Query params:
- `status=active` — filter by status
- `program=FRC` — filter by program

Response: `{ events: RevEvent[] }`

---

### `POST /api/events`

Creates a new event. Body: `Omit<RevEvent, 'id' | 'createdAt'>`. Sets `createdBy` from auth token.

Response: `{ event: RevEvent }`

---

### `GET /api/events/[id]`

Returns single event.

---

### `PATCH /api/events/[id]`

Partial update. Body: any subset of `RevEvent` fields.

---

### `GET /api/events/[id]/inventory`

Returns inventory items for the event, ordered by `part.category`, then `part.name`.

Response: `{ inventory: InventoryItem[] }`

---

### `POST /api/events/[id]/inventory`

Add or update a single inventory item. Body: `InventoryItem` (without `eventId`).

---

### `POST /api/events/[id]/inventory/csv`

Multipart form upload. Field name: `file`. CSV format in §14.

Returns `{ created: number, updated: number, errors: { row: number, message: string }[] }`.

Processing: Parse CSV, look up each SKU in the global `parts` catalog. If not found, create a new Part. Then upsert the InventoryItem.

---

### `POST /api/events/[id]/inventory/rev`

Body: `{ mode: 'all' | 'categories', categories?: string[] }`

Fetches products from REV's BigCommerce API. Creates Part records in global catalog if they don't exist. Creates InventoryItems for the event with `quantityAvailable: 0`. Returns `{ added: number }`.

---

### `GET /api/events/[id]/teams`

Returns all teams for the event, ordered by `teamNumber`.

---

### `POST /api/events/[id]/teams/csv`

Multipart CSV upload. Format in §14. Returns `{ created, updated, errors }`.

---

### `POST /api/events/[id]/teams/first`

Body: `{ program: 'FRC' | 'FTC', season: number, eventCode: string }`

Fetches teams from FIRST API (handles pagination). Upserts all teams into the event's teams sub-collection.

Returns `{ added, updated, total }`.

---

### `GET /api/transactions`

Query params:
- `eventId` (required unless admin)
- `staffEmail`
- `teamNumber`
- `from` / `to` (ISO datetime)
- `loaner=true`
- `limit` (default 200, max 1000)
- `offset`

Response: `{ transactions: Transaction[], total: number }`

---

### `POST /api/transactions`

Creates a transaction. Body: `Omit<Transaction, 'id' | 'syncStatus'>`.

Sets `syncStatus: 'synced'`. Atomically increments `quantityGiven` on each InventoryItem using a Firestore batch write.

Idempotency: If `localId` is present in the body and a transaction with that `localId` already exists, return the existing transaction (prevents double-sync).

Response: `{ transaction: Transaction }`

---

### `POST /api/transactions/sync`

Body: `{ transactions: Transaction[] }` — bulk sync from offline queue.

Calls the single-transaction creation logic for each, using `localId` for idempotency.

Returns `{ results: { localId: string, success: boolean, error?: string }[] }`

---

### `PATCH /api/transactions/[id]`

Used to mark loaner items as returned. Body: `{ itemIndex: number }` to mark a specific item returned, or `{ allReturned: true }`.

---

### `GET /api/first/events`

Query params: `program=FRC|FTC`, `season=2025`

Proxies the FIRST API. Returns `{ events: FirstEvent[] }`. Caches for 1 hour.

---

### `GET /api/first/teams`

Query params: `program`, `season`, `eventCode`

Proxies FIRST API. Returns `{ teams: FirstTeam[] }`. Handles pagination internally.

---

### `GET /api/parts`

Returns the global parts catalog. Query params: `category`, `search` (SKU or name).

---

## 9. Integrations

### 9.1 FIRST API

Base URLs:
- FRC: `https://frc-events.firstinspires.org/v2.0`
- FTC: `https://ftc-events.firstinspires.org/v2.0`

Authentication: Basic auth. Env var `FIRST_API_KEY` holds the base64-encoded `username:authToken` string.

Key endpoints used:
- `GET /{season}/events` — list all events for a season
- `GET /{season}/teams?eventCode={code}&page={n}` — paginated team list for an event

The FRC and FTC APIs share nearly the same structure. Abstract the differences in `lib/first-api.ts`.

URL parser: When an admin pastes a FIRST event URL, parse it with a regex to extract program, season, and event code:
- FRC pattern: `frc-events.firstinspires.org/{season}/{code}`
- FTC pattern: `ftc-events.firstinspires.org/{season}/{code}`

### 9.2 REV BigCommerce API

REV uses BigCommerce for their store. The catalog API is available at:
`https://api.bigcommerce.com/stores/{STORE_HASH}/v3/catalog/products`

Authentication: `X-Auth-Token: {BIGCOMMERCE_API_TOKEN}` header.

Key fields to extract per product:
- `sku`, `name`, `categories` (category IDs), `price`, `primary_image.url_thumbnail`, `variants`

Also fetch category names: `GET /v3/catalog/categories`

Map BigCommerce products to `Part` objects. Store in global `parts` catalog in Firestore.

Env vars: `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_API_TOKEN`

### 9.3 Google Cloud Storage

Use for CSV uploads and part image caching. Bucket: `{PROJECT_ID}-parts-pit-uploads`.

Upload flow:
1. Client sends multipart form to API route
2. API route streams to GCS using the Admin SDK
3. Returns public URL
4. For CSV files, also process and delete after import

---

## 10. Offline Support

### 10.1 PWA Setup

Use `next-pwa` package. Configure in `next.config.js`:
- `dest: 'public'`
- `register: true`
- `skipWaiting: true`
- `disable: process.env.NODE_ENV === 'development'`

Runtime caching strategies:
- FIRST API responses: `NetworkFirst`, 1-hour cache, 10s network timeout
- `/api/events`: `NetworkFirst`, 30-minute cache, 5s timeout
- `/api/events/*/inventory`: `NetworkFirst`, 30-minute cache, 5s timeout
- Static assets (JS, CSS, fonts): `CacheFirst`

### 10.2 Dexie.js (IndexedDB)

Install: `npm install dexie dexie-react-hooks`

Create `lib/offline.ts` with a `RevPartsDatabase` class extending `Dexie`. Tables:

```typescript
pendingTransactions: Table<PendingTransaction>  // indexed on: id, eventId, syncStatus
cachedEvents: Table<CachedEvent>                // indexed on: id, cachedAt
cachedInventory: Table<CachedInventory>         // indexed on: eventId
cachedTeams: Table<CachedTeams>                 // indexed on: eventId
```

Only instantiate the DB on the client side (`typeof window !== 'undefined'`).

Cache TTL: 30 minutes for events, inventory, and teams. On cache miss, fall back to network.

### 10.3 Sync Engine

The sync engine lives in `lib/offline.ts`. It:
1. Gets all `pendingTransactions` where `syncStatus = 'pending'`
2. POSTs each to `/api/transactions`
3. On 200: deletes from IndexedDB
4. On error: increments `retryCount`, sets `syncStatus = 'failed'` if `retryCount >= 3`
5. Returns `{ synced: number, failed: number }`

Triggers:
- `window.addEventListener('online', syncPendingTransactions)`
- Called on app startup if `navigator.onLine`
- Manual "Sync Now" button in the offline banner

On sync complete, dispatch a `CustomEvent('rev-sync-complete', { detail: { synced, failed } })` so the UI can react (refresh inventory counts, show toast).

### 10.4 OnlineDetector Component

A client component that:
- Reads `navigator.onLine` on mount
- Listens to `window.online` and `window.offline` events
- Updates `isOnline` in the Zustand app store
- When going online, triggers the sync engine
- When offline, shows a banner component

### 10.5 Offline Cart Persistence

The Zustand cart store uses `persist` middleware with `localStorage`. Cart survives page refreshes. When a transaction is submitted offline, the cart is cleared from both the in-memory store and localStorage.

---

## 11. Deployment — Google Cloud

### 11.1 Dockerfile

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080
CMD ["npm", "start"]
```

### 11.2 `.dockerignore`

```
.git
.next
node_modules
*.md
.env*
```

### 11.3 `cloudbuild.yaml`

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/rev-parts-pit:$COMMIT_SHA', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/rev-parts-pit:$COMMIT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'rev-parts-pit'
      - '--image=gcr.io/$PROJECT_ID/rev-parts-pit:$COMMIT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--set-env-vars=NODE_ENV=production'
      - '--memory=512Mi'
      - '--cpu=1'
      - '--min-instances=0'
      - '--max-instances=5'
images:
  - 'gcr.io/$PROJECT_ID/rev-parts-pit:$COMMIT_SHA'
```

### 11.4 Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated REV users can read/write
    function isRevUser() {
      return request.auth != null &&
             request.auth.token.email.matches('.*@revrobotics\\.com');
    }
    
    match /events/{eventId} {
      allow read, write: if isRevUser();
      
      match /inventory/{itemId} {
        allow read, write: if isRevUser();
      }
      match /teams/{teamId} {
        allow read, write: if isRevUser();
      }
    }
    
    match /transactions/{txId} {
      allow read, write: if isRevUser();
    }
    
    match /parts/{partId} {
      allow read: if isRevUser();
      allow write: if isRevUser();
    }
  }
}
```

### 11.5 Firestore indexes

Create composite indexes in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "eventId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "eventId", "order": "ASCENDING" },
        { "fieldPath": "staffEmail", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "inventory",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "part.category", "order": "ASCENDING" },
        { "fieldPath": "part.name", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 12. Environment Variables

### `.env.example`

```bash
# Firebase Client (public — safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Admin emails (comma-separated)
NEXT_PUBLIC_ADMIN_EMAILS=greg@revrobotics.com

# Firebase Admin (server only)
# In Cloud Run, leave empty and rely on Application Default Credentials
# In local dev, provide a service account JSON string
FIREBASE_SERVICE_ACCOUNT_KEY=

# FIRST Robotics API
# Obtain from: https://frc-events.firstinspires.org/services/API
# Format: base64(username:authKey)
FIRST_API_KEY=

# REV / BigCommerce API
BIGCOMMERCE_STORE_HASH=
BIGCOMMERCE_API_TOKEN=

# GCS bucket for uploads
GCS_BUCKET_NAME=

# Google Cloud project
GCP_PROJECT_ID=
```

### Local Development

For local dev, set `FIREBASE_SERVICE_ACCOUNT_KEY` to the contents of a downloaded service account JSON key (stringified). In Cloud Run production, leave it empty and ensure the Cloud Run service account has `roles/datastore.user` and `roles/firebaseauth.admin` IAM roles.

---

## 13. Suggested Enhancements

Implement all of the following unless scoped out:

### 13.1 Low Stock Alerts

When a staff member adds an item that would bring remaining stock to ≤ `lowStockThreshold`, show a toast warning: "⚠ Only N units of [Part Name] remaining". The toast should be amber and persist for 5 seconds.

### 13.2 Quick Reorder

The checkout success screen shows a "Give same parts to another team" button that pre-populates the cart with the just-completed transaction's items. Staff can then change the team and re-check out quickly. Useful when multiple teams need the same part simultaneously.

### 13.3 Transaction History per Device

In the checkout view, add a "Recent" tab or button showing the last 5 transactions given out from this device (stored locally in IndexedDB). This helps staff remember what they just gave out without needing admin access.

### 13.4 Part Condition Tracking

Add a `condition: 'new' | 'used' | 'damaged'` field to `TransactionItem`. The cart item row shows a small condition badge dropdown. Defaults to 'new'. Shows in the audit report. Useful for tracking if used/returned parts are being re-distributed.

### 13.5 Loaner Return Tracking

On the reports page, a "Loaners" tab shows all outstanding loaner items that haven't been returned. Staff can mark items returned from this view (with a timestamp). An admin can also send a reminder — which generates a list of teams with unreturned items and their contact emails (exportable).

### 13.6 Event Cloning

On the events list, a "Clone" action duplicates an event's inventory setup (parts, quantities, loaner flags, thresholds) to a new event. Prompts for new name and dates. Teams are not cloned (they're event-specific). This saves setup time for recurring events.

### 13.7 CSV Audit Export

On the reports page, the CSV export should be Excel-friendly: UTF-8 with BOM, proper quoting, and a summary row at the bottom. Column headers should be human-readable. Include a "Value (MSRP)" column using `part.msrp`.

### 13.8 Part Image Fallback

If a part has no `imageUrl`, display a placeholder that shows the part category as a colored icon (wrench for hardware, bolt for motors, chip for electronics, etc.). Use SVG icons from Lucide React.

### 13.9 Keyboard Shortcuts (tablet with keyboard)

On the checkout page:
- `/` focuses the search bar
- `Escape` clears search / closes modals
- `Enter` confirms the checkout modal when all fields are valid

### 13.10 Admin Activity Log

Add a simple `adminLogs` Firestore collection. Log: event creation, event status changes, inventory imports, team imports. Shown as a timeline on the event detail page. Fields: `timestamp`, `action`, `performedBy`, `details`.

### 13.11 Print Receipt

After a successful checkout, offer a "Print Receipt" button that opens a minimal print-friendly page (or uses `window.print()`) showing: event name, team, contact, timestamp, list of items, and a note if any are loaners.

### 13.12 Inventory Snapshot

When an event's status changes from 'active' to 'closed', automatically save a snapshot of the final inventory state to `events/{id}/snapshots/final`. This preserves the end-of-event counts even if items are later modified.

---

## 14. CSV Formats

### 14.1 Inventory CSV

Used for uploading parts to an event. Either reference existing SKUs or create new parts.

**Required columns:** `sku`, `name`, `quantity_available`

**Optional columns:** `category`, `pack_size`, `pack_unit`, `is_loaner`, `low_stock_threshold`, `image_url`, `description`, `msrp`

**Example:**
```csv
sku,name,category,quantity_available,pack_size,pack_unit,is_loaner,low_stock_threshold
REV-21-1650,NEO Brushless Motor V1.1,Motors,10,1,,true,2
REV-41-1251,M3 x 8mm SHCS,Hardware,500,25,bag of 25,false,50
REV-21-1652,NEO 550 Brushless Motor,Motors,8,1,,true,2
REV-31-1387,Spark MAX Motor Controller,Electronics,15,1,,true,3
```

**Rules:**
- `pack_size` defaults to 1
- `is_loaner` accepts: `true`, `false`, `yes`, `no`, `1`, `0` (case-insensitive)
- `quantity_available` is always total individual units (not packs)
- If `sku` already exists in the global parts catalog, the name/category/etc. from CSV overwrites it
- Blank cells use the existing value or default

### 14.2 Teams CSV

**Required columns:** `team_number`, `team_name`

**Optional columns:** `program`, `city`, `state`, `country`, `school`

**Example:**
```csv
team_number,team_name,program,city,state,country
2714,BBQ,FRC,Dallas,TX,USA
118,Robonauts,FRC,Houston,TX,USA
1678,Citrus Circuits,FRC,Davis,CA,USA
```

**Rules:**
- `program` defaults to the event's program if not specified
- `team_number` must be unique per event (duplicates are skipped with a warning)

---

## 15. PWA Manifest

**`public/manifest.json`:**

```json
{
  "name": "REV Parts Pit",
  "short_name": "Parts Pit",
  "description": "REV Robotics event parts distribution",
  "start_url": "/checkout",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0F0F0F",
  "theme_color": "#FF6B00",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["productivity", "utilities"],
  "prefer_related_applications": false
}
```

Create a simple REV-orange square icon with a white "RP" text for the PWA icons. The icon should feel like a REV product.

---

## Implementation Notes for Claude Code

### Start here

1. Run `npx create-next-app@latest rev-parts-pit --typescript --tailwind --app --no-src-dir --import-alias "@/*"` to scaffold.
2. Install all dependencies from the package list below.
3. Set up Firebase project and add all env vars.
4. Implement `lib/types.ts` first — everything else depends on it.
5. Implement auth (`firebase-client.ts`, `AuthProvider.tsx`, login page) and verify sign-in works.
6. Implement the Firestore service layer (`lib/firestore.ts`).
7. Implement the offline layer (`lib/offline.ts` with Dexie).
8. Build the checkout page (this is the most important screen).
9. Build the admin section.
10. Wire up the API routes.
11. Add FIRST and REV API integrations.
12. Configure next-pwa and test offline mode.
13. Write Dockerfile and cloudbuild.yaml.

### Key packages to install

```bash
npm install firebase firebase-admin dexie dexie-react-hooks next-pwa \
  papaparse lucide-react clsx tailwind-merge date-fns react-hot-toast \
  zustand @tanstack/react-query recharts axios

npm install -D @types/papaparse
```

### Important implementation details

- **Denormalize aggressively:** Embed `part` fully inside `InventoryItem`, embed `eventName` and `teamName` in `Transaction`. This eliminates the need for joins and makes the app fast offline.
- **Quantity is always in individual units:** The `quantity` field in `TransactionItem` is always individual units (never packs), even if the staff chose to dispense by pack. Store `unitType` separately to know how it was given.
- **ID generation:** Use `crypto.randomUUID()` for all generated IDs in the browser. On the server, same. Do not use auto-increment IDs.
- **Optimistic UI:** When adding to cart, update the UI immediately. Don't wait for API calls during the checkout flow.
- **Error boundaries:** Wrap the main checkout page and admin pages in React error boundaries. An error in the admin shouldn't break the checkout screen.
- **No `console.log` in production:** Use a simple `logger` utility that only logs in development mode.
- **TypeScript strict mode:** Enable `"strict": true` in `tsconfig.json`. No `any` types except in CSV parsing.

---

*End of Specification — REV Parts Pit v1.0*
