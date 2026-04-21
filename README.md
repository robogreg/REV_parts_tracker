# REV Parts Pit

A mobile-first Progressive Web App for managing and distributing spare parts to robotics teams at FRC, FTC, and FLL events. REV Robotics staff use it to log what parts were given to which teams, with full audit and export capabilities.

---

## Overview

At a competition event, teams frequently need replacement parts. REV Parts Pit gives staff a fast, offline-capable tablet interface to check out parts, mark loaners, and capture team contact info — all synced to Firestore in real time (or queued for sync when offline).

Admins manage events, upload inventory, import teams from FIRST APIs, view dashboards, and export CSV audit logs.

---

## Features

### Checkout (Staff View)
- Browse inventory with category filters and search
- Add parts to cart with quantity controls
- Toggle individual items as **loaners** (must be returned)
- Pack-size support: `-pk` SKUs offer "Pack of N" or "Individual" giving options
- Enter team number, contact name/email, and optional reason before submitting
- Low-stock warnings and override capability for out-of-stock items
- **Offline support** — transactions queue in IndexedDB and auto-sync when online

### Admin Dashboard
- **Events** — create/manage events, view live stats (transactions, parts given, loaners out)
- **Inventory** — table with inline editing of quantities and low-stock thresholds, loaner toggle, bulk delete via checkboxes
- **Teams** — team roster per event
- **Reports** — filterable transaction log with CSV export; loads recent transactions by default without requiring event selection
- **Settings** — manage FIRST API credentials (FRC + FTC) and BigCommerce API key, test connections inline

### Inventory Import
- **REV BigCommerce API** — imports the full REV product catalog, skipping hidden/discontinued/internal categories and `OLD-` SKUs, and parsing pack sizes from SKU suffixes (e.g. `REV-39-1681-pk25`)
- **CSV upload** — bulk-load inventory or teams from spreadsheet
- **FIRST API** — import registered teams for an event (FRC or FTC), with 24-hour server-side Firestore cache to avoid repeated API hits

### UX
- Dark/light mode toggle
- PWA — installable on Android/iOS/desktop, works offline
- Toast notifications for low stock, sync status, and errors

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + CSS custom properties |
| Auth | Firebase Authentication (Google OAuth, `@revrobotics.com` only) |
| Database | Cloud Firestore (via Firebase Admin SDK) |
| Offline queue | Dexie.js (IndexedDB) |
| PWA | next-pwa |
| State | Zustand (cart + app state) |
| Data fetching | TanStack Query v5 |
| Deployment | Google Cloud Run (via Cloud Build) |

---

## Project Structure

```
app/
  (auth)/login/         — Google sign-in page
  (app)/
    checkout/           — Main POS interface (staff view)
    admin/
      page.tsx          — Dashboard
      events/           — Event list, create, and detail pages
      reports/          — Transaction audit and CSV export
      settings/         — API credentials management

components/
  checkout/             — PartCard, CartPanel, CheckoutModal, etc.
  admin/                — InventoryTable, CsvUploader, TransactionTable, etc.
  ui/                   — Shared primitives (Badge, Modal, QuantityControl, etc.)

lib/
  firebase-admin.ts     — Admin SDK singleton (Firestore)
  firebase.ts           — Client SDK
  first-api.ts          — FIRST Inspires API client (FRC + FTC) with Firestore cache
  rev-api.ts            — BigCommerce product catalog client
  store.ts              — Zustand stores (cart, event, online state)
  types.ts              — Shared TypeScript types

app/api/
  events/               — CRUD for events and their inventory/teams
  transactions/         — Create, list, bulk sync
  first/events/         — Proxy to FIRST API with server-side caching
```

---

## Environment Variables

Create a `.env.local` file (never commit this):

```env
# Firebase client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (service account JSON, base64-encoded)
# On Cloud Run, Application Default Credentials are used instead.
FIREBASE_SERVICE_ACCOUNT_KEY=

# REV BigCommerce API
BIGCOMMERCE_STORE_HASH=
BIGCOMMERCE_ACCESS_TOKEN=

# FIRST Inspires API (optional — fallback credentials are baked in)
FIRST_API_KEY=        # base64(username:token) for FRC
FIRST_FTC_API_KEY=    # base64(username:token) for FTC
```

**FIRST API endpoints:**
- FRC: `https://frc-api.firstinspires.org/v2.0`
- FTC: `https://ftc-events.firstinspires.org/v2.0`

Both use HTTP Basic auth: `base64(username:authToken)`.

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with a `@revrobotics.com` Google account.

---

## Deployment

The app deploys to **Google Cloud Run** via **Cloud Build**.

### One-time setup

1. Enable APIs: Cloud Run, Cloud Build, Container Registry, Firestore
2. Create a Cloud Run service account with `roles/datastore.user`
3. Assign that service account to the Cloud Run revision (no key file needed — uses Application Default Credentials)
4. Configure Cloud Build trigger on `master` branch pushes
5. Set environment variables as Cloud Run secrets/env vars

### Deploy

Push to `master` — Cloud Build picks it up automatically:

```bash
git push origin master
```

Manual trigger:

```bash
gcloud builds submit --config cloudbuild.yaml
```

The build:
1. Builds a Docker image tagged with `$COMMIT_SHA`
2. Pushes to Container Registry (`gcr.io/$PROJECT_ID/rev-parts-pit`)
3. Deploys to Cloud Run (`us-central1`, 512 MB, 0–5 instances)

---

## CSV Formats

### Inventory CSV

```csv
sku,name,category,quantity,isLoaner,lowStockThreshold
REV-11-1261,NEO Brushless Motor,Motors,10,false,3
REV-41-1600-pk25,Anderson Connectors,Electrical,4,false,2
```

### Teams CSV

```csv
teamNumber,teamName
254,The Cheesy Poofs
1114,Simbotics
```

---

## Offline Support

When a device loses connectivity:
- The sync banner appears showing pending transaction count
- New checkouts are saved to IndexedDB via Dexie.js
- On reconnection, the queue auto-replays via `POST /api/transactions/sync`
- Duplicate prevention uses a client-generated `offlineId`

---

## Admin Access

All `@revrobotics.com` Google accounts can use the checkout interface. Admin access (`isAdmin: true`) must be set manually in Firestore under `users/{uid}`.

Super-admin features (Settings page) are restricted to `greg@revrobotics.com`.
