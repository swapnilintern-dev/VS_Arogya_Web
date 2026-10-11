# VS Arogya — Web Frontend

A standalone React web frontend for the VS Arogya B2B medicine distribution platform.
It mirrors the roles, screens, workflows and terminology of the existing Flutter
application and is built to connect to the **same** `self/server` backend.

> **Scope.** Everything in this project lives inside `self/website_vs`. The Flutter
> app, the Android/iOS projects and the `server` folder were analysed but **not
> modified** — see [`PROJECT_ANALYSIS.md`](./PROJECT_ANALYSIS.md) for the full
> read-only analysis this build was derived from.

---

## Wired to the backend

Every screen reads and writes through the Express/MongoDB server in `../server` — the
same one the Flutter app uses. There is no mock layer: `src/services/*` call the real
routes under `/vsArogya`, and `src/config/api.js` is the single list of endpoints.

---

## Running it

**1. Backend** (from `../server`, needs its `.env` — see `server/.env.example`):

```bash
npm install
```

```bash
npm run dev
```

It listens on **http://localhost:3000**. Only needed when you want to run the backend locally — by default the frontend talks to the hosted server.

**2. Frontend** (this folder):

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run dev
```

The dev server starts on **http://localhost:5180** and talks to `VITE_API_BASE_URL`
(defaults to the hosted Render backend; set it to `http://localhost:3000` to develop against a local server).

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR on port 5180 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

### Signing in

There is no role picker — exactly as in the mobile app, the **account** decides which
portal you land in. Sign in with the mobile number and password of any account in the
backend's Vendor collection (admin / marketing / delivery / area agent / buyer) or an
Outlet account; the login cascade tries `/login`, `/agent-login`, then `/outlet-login`.

| Role in the account | Lands on |
| --- | --- |
| admin | `/admin` |
| marketing | `/marketing` |
| vendor (buyer) | `/shop` |
| delivery | `/delivery` |
| agent | `/agent` |
| outlet | `/outlet` |

The **OTP Login** tab is wired to `POST /send-otp` / `POST /verify-otp`; until the server
implements them it shows "OTP sign-in is not enabled on the server yet".

---

## The six roles

| Role | Route | What it does |
| --- | --- | --- |
| **Admin** | `/admin/*` | Platform overview, vendor KYC approval, order monitoring, catalogue oversight, user management, delivery-agent onboarding, analytics, settings |
| **Marketing** | `/marketing/*` | Medicine inventory + media + **batch management**, order fulfilment pipeline, manual orders, outlet network & stock assignment, area agents, coupons, banners, push campaigns, Excel reports |
| **Vendor** | `/shop/*` | Storefront: browse, search, cart, checkout, order tracking, invoices, addresses, saved items, notifications |
| **Delivery** | `/delivery/*` | Task queue, delivery verification with doorstep payment collection, history, profile |
| **Outlet** | `/outlet/*` | Counter billing (POS), batch-tracked stock, manual orders for vendors, order + payment collection |
| **Area Agent** | `/agent/*` | Read-only monitor of every order delivering into one assigned pincode |

---

## Architecture

```
src/
├── app/           App shell, route tree, role guard
├── config/        api.js — EVERY endpoint path, one place
├── constants/     roles, order statuses, catalogue vocabulary, navigation
├── context/       AuthContext, CartContext, ToastContext
├── services/      one module per domain + http.js (the only place fetch is called)
├── hooks/         useAsync, useDebounce, useTableControls, useConfirm
├── utils/         currency, dates, expiry grading, stock grading
├── components/    common · layout · forms · tables · feedback
├── features/      cross-page domain widgets (batch picker, expiry badge, …)
├── pages/         auth · admin · marketing · vendor · delivery · outlet · agent
└── styles/        tokens · base · components · layout
```

### The data flow

```
component → hook → service → http.js → config/api.js → backend
```

**No component ever calls `fetch`.** Every network shape lives in a service, and every
URL lives in `src/config/api.js`. That is the whole integration seam.

### Design system

Hand-written CSS custom properties, no UI kit. The palette, spacing rhythm and radius
scale are taken directly from the Flutter app's `AppColors` and `lib/theme/app_theme.dart`,
so the web console and the mobile app read as one product.

Dashboards for the five internal roles use a dark sidebar shell; the Vendor experience is
a light storefront with top navigation — deliberately different, same components.

---

## Backend contract

`src/config/api.js` lists every route with its method and the body it takes;
each service file's header documents the response shape it reads
(`{ allOrders }`, `{ all_vendors }`, `{ products }`, …). Two small additive routes
were added on the server for the web build:

- `GET /single-order/:id` now also returns `order` (buyer, lines and invoice populated).
- `GET /prev-invoice/:id?format=json` returns the invoice record instead of redirecting
  to the PDF (a browser cannot follow that redirect with the Bearer header).

Sessions expire server-side after one day (seven for outlets). Any `401` clears the
stored session and returns the user to `/login`.

### Auth mechanism

The site sends `Authorization: Bearer <token>`, not the session cookie. This matches what
the Flutter app prefers and for the same reason: browsers don't expose `Set-Cookie` to JS,
and the server's CORS setup does not send credentials (`app.use(cors())` with the
`credentials: true` options object declared but never applied). See
`PROJECT_ANALYSIS.md` §9.11.

---

## Things the backend does not support yet

These surfaces are built and marked in the UI itself, so nothing looks live when it isn't:

| Surface | Status |
| --- | --- |
| Disputes | No model or route on the server — Flutter UI only |
| Account-deletion queue | Client-side store in the app; `DELETE /vendor-delete` exists for self-deletion only |
| Forgot-password OTP | `TODO(backend)` in the app; the service throws `NotImplementedError` |
| Stock report (.xlsx) | No endpoint — only order and vendor reports exist |
| Per-agent delivery assignment | The order model has no agent field, so every rider sees one shared queue |

---

## Business rules the UI enforces

Taken from the backend and the app, not invented:

- **FEFO** — stock is consumed first-expiry-first-out across a product's batches. Staff may
  pin a lot; the server re-validates it.
- **Expiry grading** — expired (blocks sale) · ≤30 d critical · ≤90 d expiring soon ·
  ≤180 d watch · beyond that good. Identical scale to `lib/widgets/expiry_alert.dart`.
- **Stock is a mirror** — a product's stock is always `SUM(batch.available_quantity)`,
  never edited directly. Restocking means adding a lot.
- **Free goods are never priced** — `freeQty` is handed over at no charge and printed in the
  invoice's FREE GOODS column.
- **Idempotency** — manual orders carry a stable client key, so a retry or double-click can
  never create a duplicate.
- **Payment status is server-owned** — no screen marks anything paid; the client only ever
  reads the state the server reports.
- **Vendor approval gate** — a buyer cannot sign in until an admin approves them.

---

## Browser support

Modern evergreen browsers. The layout is responsive from 375 px up; dashboards collapse the
sidebar into a drawer below 1024 px and the storefront reflows its navigation below 940 px.
# VS_Arogya_Web
