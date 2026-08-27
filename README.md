# VS Arogya — Web Frontend

A standalone React web frontend for the VS Arogya B2B medicine distribution platform.
It mirrors the roles, screens, workflows and terminology of the existing Flutter
application and is built to connect to the **same** `self/server` backend.

> **Scope.** Everything in this project lives inside `self/website_vs`. The Flutter
> app, the Android/iOS projects and the `server` folder were analysed but **not
> modified** — see [`PROJECT_ANALYSIS.md`](./PROJECT_ANALYSIS.md) for the full
> read-only analysis this build was derived from.

---

## Current phase: frontend only

The site runs entirely on **mock data**. No network request is made — `src/services/http.js`
refuses to issue one while `VITE_USE_MOCK` is true. Every service function already has its
real implementation written against the actual backend routes; flipping one flag switches
them over. See [Connecting the backend](#connecting-the-backend).

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

The dev server starts on **http://localhost:5180**.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR on port 5180 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

### Signing in

There is no role picker — exactly as in the mobile app, the **account** decides which
portal you land in. On the login page, the **Demo sign-in** panel (visible only while
running on mock data) signs you in as any role:

| Role | Mobile | Password | Lands on |
| --- | --- | --- | --- |
| Administrator | `9800000001` | `demo1234` | `/admin` |
| Marketing Head | `9800000002` | `demo1234` | `/marketing` |
| Vendor | `9800000003` | `demo1234` | `/shop` |
| Delivery Partner | `9800000004` | `demo1234` | `/delivery` |
| Area Agent | `9800000005` | `demo1234` | `/agent` |
| Outlet Staff | `9800000006` | `demo1234` | `/outlet` |

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
├── services/      one module per domain + http.js (the mock/live switch)
├── mock/          centralised fixtures using backend field names
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
                      ↑
             mock/*.js when USE_MOCK
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

## Connecting the backend

Everything is ready. Two steps:

**1.** Copy `.env.example` to `.env` and set:

```bash
VITE_API_BASE_URL=https://backend-new-0ady.onrender.com
VITE_USE_MOCK=false
```

**2.** Restart the dev server. That's it — no component changes.

Each service function already contains its live branch, written against the real routes.
For example:

```js
export async function listProducts() {
  if (USE_MOCK) { /* fixtures */ }
  const body = await get(ENDPOINTS.products.all, { auth: false });
  return body?.products || body?.product || body?.data || [];
}
```

### Removing the demo login

The mock role switcher is isolated in **one file**: `src/pages/auth/DevRoleSwitcher.jsx`.
Delete it, remove its import and its single usage in `LoginPage.jsx`, and set
`VITE_USE_MOCK=false`. Nothing else references it. It never bypassed authentication — it
fills the real form and submits through the normal `authService.login` path.

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
