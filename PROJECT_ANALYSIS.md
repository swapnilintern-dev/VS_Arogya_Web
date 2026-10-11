# VS Arogya — Project Analysis & Website Architecture Plan

> **Scope note.** This document is the result of a **read-only** analysis of the existing
> Flutter application (`self/lib`), its platform projects (`android`, `ios`, …) and the
> existing Express/MongoDB backend (`self/server`). Nothing outside
> `self/website_vs` was created, modified, moved or deleted.
>
> Source of truth: the Flutter app + the `server` folder. Everything described below was
> read out of that code, not invented.

---

## 0. Executive summary

| Item | Value |
| --- | --- |
| Product name | **VS Arogya** (internal code name in source headers: *MediCaPlus*) |
| Domain | B2B pharmaceutical / medicine distribution + physical outlet POS |
| Mobile app | Flutter, 132 Dart files, ~57 000 LOC, `lib/` |
| Screens discovered | **66** screen classes (+ ~20 modal/bottom-sheet sub-flows) |
| User roles | **6** — Admin, Marketing Head, Vendor (buyer/customer), Delivery Partner, Outlet Staff, Area Agent |
| Backend | Node.js + Express + MongoDB (Mongoose), `server/index.js`, all routes mounted under `/vsArogya` |
| Backend route files | 16 · controllers 17 · models 18 |
| API endpoints catalogued | **95** |
| Auth | JWT (1 day) — httpOnly cookie **and** `Authorization: Bearer` body token |
| Payments | Razorpay (order + verify, and server-minted payment links / QR) |
| Media | Cloudinary (product images, product video, banners, notification creatives) |
| Invoicing | Server-side HTML template → Puppeteer PDF → Cloudinary, plus on-device fallback |
| Push | Firebase Cloud Messaging + scheduler + per-device token registry |
| Brand palette | `#4CAF82` primary green · `#2E7D5E` dark green · `#E8F5EE` tint · `#F5F7F5` page · `#1A1A2E` text · `#E53935` error |

---

## 1. Complete directory structure of the existing project

```
self/
├── lib/                              Flutter application source
│   ├── main.dart                     MaterialApp → SplashScreen
│   ├── splash_screen.dart            session restore → homeForRole()
│   ├── sign_in_screen.dart           single login form, 3 backend fallbacks
│   ├── vendor_registration_screen.dart  4-step vendor KYC registration + AppColors
│   ├── auth/
│   │   ├── session.dart              homeForRole() role router + logout()
│   │   ├── auth_widgets.dart         PasswordField / OtpInput / AuthPrimaryButton
│   │   ├── forgot_password_screen.dart   mobile → OTP → new password → success
│   │   └── change_password_screen.dart
│   ├── services/
│   │   ├── api_config.dart           SINGLE baseUrl source of truth
│   │   ├── auth_service.dart         login, JWT capture, session persistence
│   │   ├── vendor_api_service.dart   multipart vendor registration
│   │   ├── product_media.dart
│   │   └── live_refresh.dart         LiveRefreshMixin (poll + resume)
│   ├── shared/                       form_validators, api_date, short_id
│   ├── theme/                        app_theme (tokens), app_widgets, video_player_view
│   ├── widgets/                      batch_selector, expiry_alert (ExpiryTier scale)
│   ├── admin/                        Admin role  (shell + 11 screens + api + models)
│   ├── marketing/                    Marketing role (shell + 15 screens + api + models)
│   ├── customer/                     Vendor/buyer role (shell + 13 screens + api)
│   ├── delivery/                     Delivery role (shell + 4 screens + api)
│   ├── outlet/                       Outlet Staff role (shell + 8 screens + billing wizard)
│   ├── agent/                        Area Agent role (dashboard + 2 screens)
│   ├── notifications/                Push/notification API + models + controllers
│   └── account_deletion/             Play-Store deletion request flow
│
├── server/                           Express + MongoDB backend (READ ONLY)
│   ├── index.js                      app bootstrap, 16 routers under /vsArogya
│   ├── routes/                       16 route files
│   ├── controller/                   17 controllers
│   ├── model/                        18 Mongoose models
│   ├── middlewares/                  isAuthenticated, requireRole, multer
│   ├── utils/                        db, cloudinary, razorpay, fcm, inventory (FEFO),
│   │                                 invoiceGenerator, generatePdf, freeGoods,
│   │                                 notificationBroadcast, notificationScheduler
│   ├── templates/invoiceTemplate.js  HTML tax invoice
│   └── scripts/                      migrateBatches, migrateOutletBatches
│
├── android/ ios/ macos/ linux/ windows/ web/    Flutter platform projects
├── assets/                           fonts, icon, invoice brand assets
├── test/                             Flutter widget/unit tests
└── *.md                              integration specs (see §9)
```

### State management
No state-management package. The whole app uses **`ChangeNotifier` singletons**
(`CartController`, `OrdersController`, `MarketingProductsController`,
`DeliveryController`, `OutletCart`, `NotificationController`, …) observed with
`ListenableBuilder`. Comments explicitly call these "the seam where Riverpod/Bloc could
plug in". The website mirrors this with React Context + hooks.

### Navigation
Imperative `Navigator.push` with `MaterialPageRoute`. **No named routes exist** — role
shells are `IndexedStack` + `NavigationBar`, detail screens are pushed on top. The website
therefore has to *invent* a URL scheme (§5), which is the single biggest mobile→web
translation decision.

---

## 2. User roles

Roles come from the login response's `role` field and are dispatched by
`homeForRole()` in `lib/auth/session.dart`:

| Role token(s) | Shell | Collection | Login endpoint |
| --- | --- | --- | --- |
| contains `admin` | `AdminRoleMain` | `Vendor` | `POST /vsArogya/login` |
| contains `marketing` | `MarketingRoleMain` | `Vendor` | `POST /vsArogya/login` |
| contains `outlet` | `OutletMain` (guarded by `OutletSession.isLive`) | `Outlet` | `POST /vsArogya/outlet-login` |
| contains `delivery` | `DeliveryMain` | `Vendor` (role `delivery`) | `POST /vsArogya/login` → fallback `POST /vsArogya/agent-login` |
| contains `agent` (after delivery) | `AgentMain` (guarded by `AgentSession.isLive`) | `Vendor` (role `agent` + `pin_code`) | `POST /vsArogya/login` |
| anything else / `vendor` | `CustomerShell` | `Vendor` | `POST /vsArogya/login` |

Server-side (`userController.login`): `staffRoles = ["admin","marketing","delivery","agent","outlet"]`
skip the approval gate. A **buyer/vendor must be `approvalStatus === "Approved"`** or login
is refused with 403 (`Pending` / `Rejected` produce distinct messages).

### Sign-in cascade (`lib/sign_in_screen.dart`)
There is **no role picker** on screen. One mobile+password form tries, in order:
1. `POST /vsArogya/login` (Vendor collection: admin / marketing / delivery / agent / buyer)
2. `POST /vsArogya/agent-login` (delivery agent collection)
3. `POST /vsArogya/outlet-login` (Outlet collection)

The first success decides the role and destination.

---

## 3. Complete screen inventory (66 screens)

### 3.1 Entry / Auth (7)

| Screen | File | Role | Purpose |
| --- | --- | --- | --- |
| SplashScreen | `lib/splash_screen.dart` | all | restore saved session (23 h), route via `homeForRole` |
| SignInScreen | `lib/sign_in_screen.dart` | all | mobile + password, 3-collection cascade |
| VendorRegistrationScreen | `lib/vendor_registration_screen.dart` | public | 4-step KYC: Basic → Business → Documents → Review |
| RegistrationSuccessScreen | same file | public | 3-stage "what happens next" |
| ForgotPasswordScreen | `lib/auth/forgot_password_screen.dart` | public | mobile → OTP (30 s resend) → new password → success (OTP is TODO(backend)) |
| ChangePasswordScreen | `lib/auth/change_password_screen.dart` | vendor, delivery | new + confirm, no OTP |
| PrivacySecurityScreen | `lib/account_deletion/privacy_security_screen.dart` | vendor, delivery | change password / delete account entry |

**Registration form fields** (server `POST /register-vendor`, multipart):
`vendor_type` (Shop / Pharmacy, Hospital / Clinic) · `shop_type` (Retail / Wholesale /
Online / Hospital Pharmacy, Ayurvedic-Herbal Store, Medical Equipment) · `store_name` ·
`contact_person_name` · `mobile_no` · `email` · `full_address` · `city` · `state` ·
`pin_code` · `gst_status` (Registered Regular / Registered Composition / Unregistered /
Exempt) · `gst_no` · `drug_lic_no` · `drug_lic_ex_date` · files `store_pic`,
`drug_lic_copy` (mandatory), `gst_pdf` (optional).

### 3.2 Admin (13)

| Screen | File | Data source |
| --- | --- | --- |
| AdminOverviewScreen (tab 0) | `admin/screens/overview_screen.dart` | `GET /total-revenue`, `/all-orders`, `/active-vendors`, `/pending-vendor` |
| AdminVendorsScreen (tab 1) | `admin/screens/vendors_screen.dart` | `GET /all-vendors` — filters: status, registration source, recency, sort |
| AdminOrdersScreen (tab 2) | `admin/screens/orders_screen.dart` | `GET /all-orders` + 4 status-advance PUTs |
| AdminUsersScreen (tab 3) | `admin/screens/users_screen.dart` | `GET /all-vendors` split Vendors / Delivery Agents |
| AdminSettingsScreen (tab 4) | `admin/screens/settings_screen.dart` | static groups: Platform, Operations, Sign Out |
| VendorReviewScreen | `admin/screens/vendor_review_screen.dart` | KYC doc checklist, Approve / Reject |
| UserDetailScreen | `admin/screens/user_detail_screen.dart` | adaptive per user kind: stats, info, timeline, documents |
| AdminOrdersScreen detail sheet | same file | items + address + invoice |
| AdminProductsScreen | `admin/screens/products_screen.dart` | `GET /all-products` + SKU stat strip |
| AddProductScreen (admin) | `admin/screens/add_product_screen.dart` | catalogue entry form (Save Draft / Publish) |
| AdminAnalyticsScreen | `admin/screens/analytics_screen.dart` | computed from `/total-revenue` + `/all-orders`: orders by city, delivered rate, repeat buyers, category split |
| DeliveryManagementScreen | `admin/screens/delivery_management_screen.dart` | `POST /agent-create` → server returns generated 6-digit password |
| DisputeScreen | `admin/screens/dispute_screen.dart` | ⚠ frontend-only (no backend) |
| AdminDeletionRequestsScreen | `account_deletion/admin_deletion_requests_screen.dart` | ⚠ frontend-only store |

### 3.3 Marketing Head (16)

| Screen | File | Backing endpoints |
| --- | --- | --- |
| MarketingDashboardScreen (tab 0) | `marketing/dashboard_screen.dart` | 2×2 stat grid (pending orders, ready to ship, low/out stock, active coupons) + 4 quick actions + recent orders |
| MarketingOrdersScreen (tab 1) | `marketing/orders_screen.dart` | `GET /all-orders`, pipeline tabs New/Packing/Ready/Shipped/Done |
| MarketingProductsScreen (tab 2) | `marketing/products_screen.dart` | `GET /all-products`, status + category chips, Edit / Activate-Deactivate |
| MarketingCouponsScreen (tab 3) | `marketing/coupons_screen.dart` | `GET/POST/PUT/DELETE /coupons` |
| AddMedicineScreen (add/edit) | `marketing/add_product_screen.dart` | `POST /add-product`, `PUT /update-product/:id` (multipart) |
| ProductMediaEditor | `marketing/product_media_editor.dart` | multi-image (reorderable, first = primary) + one promo video, compress + preview |
| BatchManager | `marketing/batch_manager.dart` | `GET/POST /product/:id/batches`, `PUT/DELETE /batch/:batchId` |
| ManualOrderScreen | `marketing/manual_order_screen.dart` | vendor → products → qty (FEFO batch aware) → review → `POST /manual-cart/:vendorId/:itemId` ×n then `POST /manual-order/:vendorId` |
| OrderDetailsScreen (marketing) | `marketing/order_details_screen.dart` | full order + contextual pipeline action |
| StaffInvoiceScreen | `marketing/invoice_screen.dart` | `GET /prev-invoice/:id` → 302 → PDF, on-device fallback |
| MarketingBannersScreen | `marketing/banners_screen.dart` | `GET/POST/DELETE /promo-banners` |
| CreateCampaignScreen | `marketing/create_campaign_screen.dart` | campaign name, type (Coupon/Banner/Push), audience, dates, estimated reach |
| SelectOutletScreen | `marketing/select_outlet_screen.dart` | pincode → outlet → medicine → **mandatory FEFO batch pick** → qty → `POST /outlet-stock` (one call per medicine) |
| OutletRegistrationScreen | `marketing/outlet_registration_screen.dart` | `POST /outlet-register` (every field required) |
| AgentRegistrationScreen | `marketing/agent_registration_screen.dart` | `POST /agent-register` (name, mobile, email, pincode, password) |
| MarketingReportsScreen | `marketing/reports_screen.dart` | `GET /order-report`, `GET /vendor-report` (.xlsx). Stock report = "Coming soon" (no endpoint) |
| AssignAgentSheet | `marketing/assign_agent_sheet.dart` | live delivery partners from `/all-vendors` role=delivery |

### 3.4 Vendor / Customer (14)

| Screen | File | Endpoints |
| --- | --- | --- |
| HomeScreen (tab 0) | `customer/home_screen.dart` | `/all-products`, `/promo-banners`, categories, featured, best sellers |
| ProductListScreen (tab 1 / Search) | `customer/product_list_screen.dart` | search, category chips, sort sheet, skeletons |
| CartScreen (tab 2) | `customer/cart_screen.dart` | `/getCart-product`, `/add-cart/:id`, `/increase-cart-item/:id`, `/dec-cart-itm/:id`, `/remove-cart-item/:id`, `/clear-cart` |
| OrdersScreen (tab 3) | `customer/orders_screen.dart` | `/get-order`, filters All/Active/Delivered/Cancelled, Reorder |
| ProfileScreen (tab 4) | `customer/profile_screen.dart` | header, quick stats, settings list |
| ProductDetailsScreen | `customer/product_details_screen.dart` | gallery, video, qty, wishlist, related, Buy Now |
| CheckoutScreen | `customer/checkout_screen.dart` | address pick, payment method, `POST /place-order`, `POST /create-payment/:id`, `POST /verify-payment` |
| OrderDetailsScreen | `customer/order_details_screen.dart` | live status timeline (poll), Reorder / Cancel |
| AddressesScreen | `customer/addresses_screen.dart` | `GET/POST/PUT/DELETE /addresses` (+ select mode) |
| SavedItemsScreen | `customer/saved_items_screen.dart` | `GET /all-saved`, `POST /save-prod/:id` |
| InvoicePreviewScreen | `customer/invoice_preview_screen.dart` | `GET /prev-invoice/:id` |
| InvoiceCard | `customer/invoice_card.dart` | download PDF (server-first, on-device fallback) |
| AboutUsScreen | `customer/about_us_screen.dart` | static company content, cold-chain storage guidance |
| DeleteAccountScreen | `account_deletion/delete_account_screen.dart` | ⚠ frontend-only request store |

### 3.5 Delivery Partner (4)

| Screen | File | Endpoints |
| --- | --- | --- |
| TasksDashboardScreen (tab 0) | `delivery/screens/tasks_dashboard_screen.dart` | `GET /all-orders` → tasks = Shipped (next) + Out for Delivery (active) |
| DeliveryProfileScreen (tab 1) | `delivery/screens/profile_screen.dart` | rider profile, vehicle, earnings summary |
| DeliveryVerificationScreen | `delivery/screens/delivery_verification_screen.dart` | item verify, payment settle (online link / QR / cash), `PUT /delivered-prder/:id`; `POST /delivery/payment-link/:id`, `GET /delivery/payment-status/:id` |
| DeliveryHistoryScreen | `delivery/screens/delivery_history_screen.dart` | delivered orders, Today/Week/Month/All |

> ⚠ **Known backend gap** (documented in `delivery_api.dart`): the order model has **no
> per-agent assignment field**, so every delivery agent currently sees the same
> platform-wide dispatch queue.

### 3.6 Outlet Staff (11)

| Screen | File | Endpoints |
| --- | --- | --- |
| OutletDashboardScreen (tab 0) | `outlet/screens/outlet_dashboard_screen.dart` | counters from orders + stock, New manual order, Billing entry |
| OutletStockScreen (tab 1) | `outlet/screens/outlet_stock_screen.dart` | `GET /outlet-products/:id` |
| OutletOrdersScreen (tab 2) | `outlet/screens/outlet_orders_screen.dart` | `GET /outlet-orders/:id` + status filter |
| Outlet Profile (tab 3) | `outlet/outlet_main.dart` (inline) | `GET /outlet-profile/:id`, 30 s poll |
| OutletMedicineDetailsScreen | `outlet/screens/outlet_medicine_details_screen.dart` | `GET /outlet/product/:id/available-batches?all=1` — every lot incl. expired/empty |
| OutletManualOrderScreen | `outlet/screens/outlet_manual_order_screen.dart` | `POST /outlet/allocate-preview` → manual-cart ×n → `POST /outlet/manual-order/:id` |
| OutletPaymentScreen | `outlet/screens/outlet_payment_screen.dart` | `POST /outlet/orders/:id/razorpay` · `/verify` · `/payment` · `GET /status` |
| OutletOrderDetailScreen | `outlet/screens/outlet_order_detail_screen.dart` | state-aware actions: Collect payment / Mark handed over / Mark ready for pickup |
| OutletInvoiceScreen | `outlet/screens/outlet_invoice_screen.dart` | `GET /prev-invoice/:id` with outlet token, ~1 min retry |
| BillingScreen (POS wizard, 3 steps) | `outlet/billing/billing_screen.dart` + `steps/` | Customer → Products → Review & pay |
| BillingSuccessScreen | `outlet/billing/billing_success_screen.dart` | background `POST /register-vendor`, invoice download/share |
| OutletBatchPicker (sheet) | `outlet/outlet_batch_picker.dart` | `GET /outlet/product/:id/available-batches` (FEFO, sellable only) |

### 3.7 Area Agent (3)

| Screen | File | Endpoints |
| --- | --- | --- |
| AgentMain (dashboard) | `agent/agent_main.dart` | `POST /pin-orders/:agentId` — orders whose delivery pincode matches the agent |
| AgentOrderDetailScreen | `agent/agent_order_detail.dart` | read-only timeline + line items |
| AgentProfileScreen | `agent/agent_profile_screen.dart` | `GET /agent-profile/:id` |

The Area Agent role is **strictly read-only monitoring**. No actions on orders.

### 3.8 Notifications (module, no screens yet)

`lib/notifications/` ships a complete **API + models + controllers** layer against a fully
implemented backend (`notificationRoute.js` + `notificationController.js` + FCM +
scheduler), but **no Flutter screens have been built for it yet**. The website implements
both sides (vendor notification center, marketing broadcast panel) because the contract is
fully specified in code — nothing is invented.

---

## 4. Backend API inventory (95 endpoints, all under `/vsArogya`)

Auth column: **🔒** = `isAuthenticated` (JWT via cookie or `Authorization: Bearer`),
**🔒marketing** = `isAuthenticated` + `requireRole("marketing")`, **–** = open.

### 4.1 Auth & vendor account — `routes/userRoute.js`
| Method | Path | Auth | Body / Params | Returns |
| --- | --- | --- | --- | --- |
| POST | `/login` | – | `{mobile_no, password}` | `{success, message, role, token, id, pincode, name}` |
| POST | `/logout` | 🔒 | – | `{success, message}` |
| POST | `/register-vendor` | – | multipart: KYC fields + `gst_pdf`, `store_pic`, `drug_lic_copy` | `{success, message}` |
| DELETE | `/vendor-delete` | 🔒 | – | `{success, message}` |
| GET | `/addresses` | 🔒 | – | `{success, addresses[]}` |
| POST | `/addresses` | 🔒 | Address | `{success, addresses[]}` |
| PUT | `/addresses/:addressId` | 🔒 | Address | `{success, addresses[]}` |
| DELETE | `/addresses/:addressId` | 🔒 | – | `{success, addresses[]}` |

### 4.2 Products — `routes/postRouter.js`
| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/add-product` | – | multipart, up to N images + 1 video |
| GET | `/all-products` | – | full catalogue (shared by customer / marketing / admin / outlet) |
| PUT | `/update-product/:id` | – | multipart |
| DELETE | `/delete-product/:id` | – | |
| GET | `/share-prod/:id` | 🔒 | shareable URL |
| POST | `/save-prod/:id` | 🔒 | wishlist toggle |
| GET | `/all-saved` | 🔒 | wishlist list |

### 4.3 Batches (FEFO inventory) — `routes/batchRoute.js`
| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/product/:id/batches` | – | all lots of a product |
| GET | `/product/:id/available-batches` | – | sellable only, FEFO order |
| POST | `/allocate-preview` | – | non-mutating "can this qty be issued?" |
| POST | `/product/:id/batches` | – | add lot |
| PUT | `/batch/:batchId` | – | edit lot |
| DELETE | `/batch/:batchId` | – | delete lot |

### 4.4 Cart — `routes/cartRoute.js` (all 🔒)
`POST /add-cart/:id` · `GET /getCart-product` · `DELETE /remove-cart-item/:id` ·
`POST /increase-cart-item/:id` · `POST /dec-cart-itm/:id` · `POST /clear-cart`

### 4.5 Orders — `routes/orderRoute.js` (all 🔒)
`POST /place-order` · `POST /place-single-ord/:id` · `GET /get-order` · `PUT /cancel-order/:id`

### 4.6 Admin — `routes/adminRoute.js` (all open at route level ⚠)
`GET /pending-vendor` · `PUT /approval-mail/:id` · `PUT /reject-vendor/:id` ·
`GET /all-orders` · `GET /single-order/:id` · `PUT /confirm-order/:id` ·
`PUT /shipped-order/:id` · `PUT /outof-delivery/:id` · `PUT /delivered-prder/:id` ·
`GET /all-vendors` · `GET /active-vendors` · `GET /total-revenue`

> ⚠ **Finding:** the admin routes carry **no auth middleware**. Flagged in §9.

### 4.7 Payments — `routes/paymentRoute.js` (🔒)
`POST /create-payment/:id` · `POST /verify-payment`

### 4.8 Banners — `routes/bannerRoute.js`
`GET /promo-banners` · `POST /promo-banners` (multipart `image`) · `DELETE /promo-banners/:id`

### 4.9 Coupons — `routes/couponRoute.js`
`GET /coupons` · `POST /coupons` · `PUT /coupons/:code/toggle` · `DELETE /coupons/:code`

### 4.10 Invoice — `routes/invoiceRoute.js`
`GET /prev-invoice/:id` 🔒 → 302 redirect to hosted PDF

### 4.11 Delivery — `routes/deliveryRoute.js`
`POST /agent-create` · `POST /agent-login` ·
`POST /delivery/payment-link/:id` 🔒 · `GET /delivery/payment-status/:id` 🔒

### 4.12 Manual orders — `routes/manualRoute.js`
`POST /manual-cart/:vendorId/:itemId` · `POST /manual-order/:vendorId`

### 4.13 Reports — `routes/xlshRoute.js`
`GET /order-report` (.xlsx) · `GET /vendor-report` (.xlsx)

### 4.14 Outlet — `routes/outletRoute.js`
| Method | Path | Auth |
| --- | --- | --- |
| POST | `/outlet-register` | – |
| POST | `/outlet-login` | – |
| GET | `/outlets?pincode=` | 🔒 |
| POST | `/outlet-stock`, `/outlet-addstock` | 🔒 |
| GET | `/outlet-profile/:id` | 🔒 |
| GET | `/outlet-products/:id` · POST `/outlet-allstocks/:id` | 🔒 |
| GET | `/outlet-orders/:id` | 🔒 |
| POST | `/outlet/orders/:id/razorpay` · `/verify` · `/payment` · GET `/status` | 🔒 |
| POST | `/outlet/add-cart` · GET `/outlet/cart-summary` · POST `/outlet/clear-cart` | 🔒 |
| GET | `/outlet/product/:productId/available-batches` | 🔒 |
| POST | `/outlet/allocate-preview` · `/outlet/bill` | 🔒 |
| POST | `/outlet/register-vendor` | 🔒 |
| POST | `/outlet/manual-order/:id` · GET `/outlet/order-history` | 🔒 |

### 4.15 Area Agent — `routes/agentRoute.js`
`POST /agent-register` 🔒 · `POST /area-agent-login` · `POST /pin-vendors/:id` ·
`POST /pin-orders/:id` · `GET /agent-profile/:id`

### 4.16 Notifications — `routes/notificationRoute.js`
| Group | Endpoints |
| --- | --- |
| Shared 🔒 | `GET /notifications/meta` · `POST/PUT/DELETE /notifications/device-token` · `GET /notifications/settings` · `PUT /notifications/preferences` |
| Vendor 🔒 | `GET /notifications/inbox` · `GET /notifications/inbox/unread-count` · `POST /notifications/inbox/read-all` · `POST /notifications/inbox/:id/read` · `/delivered` · `/opened` · `DELETE /notifications/inbox/:id` |
| Marketing 🔒marketing | `GET /notifications/audience` · `GET /notifications` · `POST /notifications` · `PUT /notifications/:id` · `POST /notifications/:id/send` · `/retry` · `/duplicate` · `GET /notifications/:id/stats` · `GET /notifications/:id` · `DELETE /notifications/:id` |

---

## 5. Data entities (Mongoose models → website types)

### `Vendor` (`userModel.js`) — one collection for **every** Vendor-side account
`role` · `vendor_type` · `shop_type` · `store_name` · `contact_person_name` · `mobile_no` (unique) ·
`email` (unique) · `full_address` · `city` · `state` · `pin_code` · `gst_status` (`yes|no`) ·
`gst_no` · `drug_lic_no` · `drug_lic_ex_date` · `registrationSource` (`admin|outlet`) ·
`password` · `gst_pdf{url,publicId,fileName}` · `store_pic{url,publicId}` ·
`drug_lic_copy{…}` · `cart[{product, quantity, freeQty, allocations[]}]` ·
`approvalStatus` (`Pending|Approved|Rejected`) · `notificationsEnabled` · `savedProducts[]` ·
`addresses[{label, fullName, phone, line1, city, state, pincode, isDefault}]` · timestamps

### `product` (`productModel.js`)
`title` · `description` · `price` · `category` · `cold_stored` · `batch_no` · `exp_date` ·
`mrp` · `brand` · `code` · `manufacturer` · `marketedBy` · `stock` · `active` · `packOf` ·
`hsnCode` · `gstPercent` · `discountPercent` · `lowThreshold` (10) · `prescriptionRequired` ·
`rating` · `reviewCount` · `badge` · `packInfo` · `image[{url,publicId}]` (first = primary) ·
`video{url,publicId}` · `quantity` · virtual **`isExpiringSoon`** (≤ 90 days)

`batch_no` / `exp_date` / `stock` are **auto-synced mirrors** of the batch collection.

### `productBatch` (`productBatchModel.js`) — the FEFO lot
`product_id` · `batch_number` (unique per product) · `purchase_quantity` ·
`available_quantity` · `purchase_price` · `selling_price` · `manufacturing_date` ·
`expiry_date` · `supplier` · virtual `isExpiringSoon`

### `order` (`orderModel.js`)
`user` (Vendor) · `outlet` (optional) ·
`orderItems[{product, quantity, orderPrice, freeQty, batch_no, exp_date, allocations[{batch, batch_number, expiry_date, quantity}]}]` ·
`shippingAddress{address, city, state, pincode, country, phoneNo}` ·
`paymentMethod` (`COD|ONLINE`) ·
`paymentInfo{razorpay_id, razorpay_orderId, razorpay_signature, link_id, link_url, link_expiresAt, status: Pending|Completed|Failed|Refunded}` ·
`paidAt` · `totalAmount` ·
`orderStatus` (`Pending | Confirm Order | Shipped | Out for Delivery | Delivered | Cancelled`) ·
`deliveredAt` · `invoice` · `orderNo` · `amountWord` · `orderType` (`byApp`) ·
`source` (`MANUAL_BY_MARKETING`) · `createdBy` · `clientOrderId` (unique, sparse — idempotency)

### `Invoice`
`invoiceNumber` (unique) · `order` · `vendor` · `pdfUrl` · `subtotal` · `cgst` · `sgst` · `igst` · `grandTotal` · `generatedAt`

### `Outlet` (`outletregistersModel.js`)
`outletName` · `ownerName` · `mobileNo` · `email` · `password` · `address` · `city` ·
`state` · `pincode` · `gstNumber` · `status` (`Active|Inactive`) · `role` (`outlet`) ·
`cart[{product, quantity, freeQty, allocations[]}]`

### `outletStock` / `outletStockBatch`
Outlet-held quantity mirror + the outlet's own batch lots (same batch identity as the
catalog lot they came from).

### Others
`Banner` · `couponModel` · `marketingAgent` · `deliveryagentModel` · `notificationModel` ·
`notificationReceiptModel` · `deviceTokenModel` · `cartModel`

---

## 6. Business rules extracted from code (these drive the website UI)

1. **FEFO (First-Expiry-First-Out)** — `server/utils/inventory.js` allocates stock across
   batches nearest-expiry-first. Staff may *pin* a lot; the server re-validates it.
2. **Expiry grading** (`lib/widgets/expiry_alert.dart`, shared by every role):
   `expired` (<0 d, blocks sale) · `critical` (≤30 d) · `warning`/Expiring Soon (≤90 d) ·
   `caution`/Watch (≤180 d) · `safe`/Good (>180 d) · `unknown` (no printed expiry).
   Backend `isExpiringSoon` = ≤90 days.
3. **Stock mirrors** — `product.stock === SUM(batch.available_quantity)`; never edited directly.
4. **Free goods** — `freeQty` on a line is never priced; printed in a FREE GOODS invoice column.
5. **Idempotency** — manual orders carry `clientOrderId` (marketing) / `idempotencyKey`
   (outlet cart), stable across retries so a double-submit can't duplicate an order.
6. **Locked outlet rules** —
   #1 own-outlet stock is actionable, district stock read-only;
   #2 address form appears **only** for DELIVERY orders (not COUNTER);
   #3 **payment status is server-owned** — the client never marks anything paid.
7. **Vendor approval gate** — a buyer cannot log in until Admin approves; approval emails credentials.
8. **Order pipeline** — `Pending → Confirm Order → Shipped → Out for Delivery → Delivered`,
   plus `Cancelled`. Marketing pipeline labels: **New / Packing / Ready / Shipped / Done**.
   Accepting (`confirm-order`) is what generates the invoice and deducts stock; cancelling restores it.
9. **Medicine categories** (canonical, 3): `Lifesaving Injections`, `Vaccines`, `Medicine`.
10. **Marketing → outlet stock assignment** is *additive* ("how much more to send"),
    deducts from global catalog stock, and **requires a batch pick**.

---

## 7. Permission matrix

| Capability | Admin | Marketing | Vendor | Delivery | Outlet | Agent |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Platform overview / KPIs | ✅ | ➖ own dashboard | — | — | ➖ own | — |
| Approve / reject vendors | ✅ | — | — | — | — | — |
| Vendor directory | ✅ | ➖ read (manual order) | — | — | ➖ read (billing) | ➖ pincode read |
| Platform user directory | ✅ | — | — | — | — | — |
| Create delivery agent | ✅ | — | — | — | — | — |
| Register outlet | — | ✅ | — | — | — | — |
| Register area agent | — | ✅ | — | — | — | — |
| Product create / edit / delete | ✅ (basic) | ✅ (full + media) | — | — | — | — |
| Batch management | ➖ view | ✅ | — | — | ➖ view own lots | — |
| Assign stock to outlet | — | ✅ | — | — | — | — |
| Coupons | — | ✅ | ➖ apply | — | — | — |
| Promo banners | — | ✅ | ➖ view | — | — | — |
| Push campaigns | — | ✅ | ➖ inbox | ➖ inbox | ➖ inbox | ➖ inbox |
| Browse catalogue / cart / checkout | — | — | ✅ | — | ➖ own stock | — |
| Place manual order for a vendor | — | ✅ | — | — | ✅ | — |
| Advance order status | ✅ | ✅ | — | ➖ OFD + Delivered | ➖ own | — |
| Cancel order | ✅ | ✅ | ✅ own | — | — | — |
| Invoices | ✅ | ✅ | ✅ own | — | ✅ own | — |
| POS billing (walk-in) | — | — | — | — | ✅ | — |
| Collect payment | — | — | ✅ own | ✅ doorstep | ✅ counter | — |
| Excel reports | ➖ | ✅ | — | — | — | — |
| Delivery task queue | ➖ manage | ➖ assign | — | ✅ | — | — |
| Pincode order monitor | — | — | — | — | — | ✅ read-only |

✅ full · ➖ partial/read-only · — none

---

## 8. Flutter screen → Website page mapping

| Flutter screen | Website route | Translation notes |
| --- | --- | --- |
| SplashScreen | *(none)* | web has no splash; session bootstrap happens in `AuthProvider` |
| SignInScreen | `/login` | same single form + role cascade; dev role switcher added |
| VendorRegistrationScreen (4 steps) | `/register` | same 4 steps, desktop 2-column wizard with a sticky summary rail |
| RegistrationSuccessScreen | `/register/success` | |
| ForgotPasswordScreen | `/forgot-password` | stepped card |
| **Admin** | | |
| AdminOverviewScreen | `/admin` | KPI grid + revenue trend + recent orders table |
| AdminVendorsScreen | `/admin/vendors` | bottom-nav tab → sidebar item; cards → data table + filter bar |
| VendorReviewScreen | `/admin/vendors/:id` | full-page KYC review, doc checklist rail |
| AdminOrdersScreen | `/admin/orders` | status tabs → table with segmented filter + drawer detail |
| Order detail sheet | `/admin/orders/:id` | sheet → full page |
| AdminUsersScreen | `/admin/users` | segment tabs kept, table layout |
| UserDetailScreen | `/admin/users/:id` | |
| AdminProductsScreen | `/admin/products` | SKU stat strip + table |
| AddProductScreen (admin) | `/admin/products/new` | modal → dedicated page |
| AdminAnalyticsScreen | `/admin/analytics` | charts get real width on desktop |
| DeliveryManagementScreen | `/admin/delivery` | form + agent table side by side |
| AdminDeletionRequestsScreen | `/admin/deletion-requests` | |
| AdminSettingsScreen | `/admin/settings` | grouped settings panels |
| **Marketing** | | |
| MarketingDashboardScreen | `/marketing` | stat grid + quick actions + recent orders |
| MarketingOrdersScreen | `/marketing/orders` | pipeline tabs → segmented control over a table |
| OrderDetailsScreen | `/marketing/orders/:id` | |
| ManualOrderScreen | `/marketing/orders/manual` | 4 mobile steps → **3-pane desktop builder** (vendor · catalogue · cart) |
| MarketingProductsScreen | `/marketing/products` | rich cards → dense table with stock/expiry indicators |
| AddMedicineScreen + media + batches | `/marketing/products/new`, `/marketing/products/:id` | tabbed editor: Details · Media · Batches |
| BatchManager | inside `/marketing/products/:id` (Batches tab) | full batch table + add/edit modal |
| MarketingCouponsScreen | `/marketing/coupons` | |
| CreateCampaignScreen | `/marketing/coupons/new` | |
| MarketingBannersScreen | `/marketing/banners` | upload + grid |
| SelectOutletScreen | `/marketing/outlets/assign-stock` | pincode → outlet → basket, with mandatory batch picker modal |
| OutletRegistrationScreen | `/marketing/outlets/new` | |
| AgentRegistrationScreen | `/marketing/agents/new` | |
| MarketingReportsScreen | `/marketing/reports` | |
| *(notification module, no Flutter screen)* | `/marketing/notifications`, `/marketing/notifications/new` | broadcast composer + stats |
| **Vendor** | | |
| HomeScreen | `/shop` | storefront: banner carousel, categories, featured grid |
| ProductListScreen | `/shop/products` | filter sidebar + grid/list toggle + sort |
| ProductDetailsScreen | `/shop/products/:id` | gallery left / buy box right |
| CartScreen | `/shop/cart` | line table + sticky summary rail |
| CheckoutScreen | `/shop/checkout` | 3-column: address · payment · summary |
| OrdersScreen | `/shop/orders` | |
| OrderDetailsScreen | `/shop/orders/:id` | timeline + invoice card |
| InvoicePreviewScreen | `/shop/orders/:id/invoice` | |
| AddressesScreen | `/shop/addresses` | |
| SavedItemsScreen | `/shop/saved` | |
| ProfileScreen | `/shop/profile` | |
| *(notification inbox)* | `/shop/notifications` | |
| AboutUsScreen | `/shop/about` | |
| **Delivery** | | |
| TasksDashboardScreen | `/delivery` | task cards + queue table |
| DeliveryVerificationScreen | `/delivery/tasks/:id` | item checklist + payment settle + confirm |
| DeliveryHistoryScreen | `/delivery/history` | range filter + summary |
| DeliveryProfileScreen | `/delivery/profile` | |
| **Outlet** | | |
| OutletDashboardScreen | `/outlet` | |
| OutletStockScreen | `/outlet/stock` | table with batch count + expiry chips |
| OutletMedicineDetailsScreen | `/outlet/stock/:id` | lot table (incl. expired/empty) |
| OutletManualOrderScreen | `/outlet/orders/new` | cart review + customer + fulfilment + payment |
| OutletOrdersScreen | `/outlet/orders` | |
| OutletOrderDetailScreen | `/outlet/orders/:id` | state-aware action bar |
| OutletPaymentScreen | `/outlet/orders/:id/payment` | QR + link + poll |
| BillingScreen (3-step POS) | `/outlet/billing` | desktop POS: catalogue left, bill right |
| BillingSuccessScreen | `/outlet/billing/success` | |
| Outlet profile tab | `/outlet/profile` | |
| **Agent** | | |
| AgentMain | `/agent` | pincode order monitor table |
| AgentOrderDetailScreen | `/agent/orders/:id` | read-only timeline |
| AgentProfileScreen | `/agent/profile` | |

---

## 9. Missing / ambiguous functionality found during analysis

These are **findings about the existing project**, recorded for the backend-integration
phase. Nothing here was changed.

| # | Finding | Impact on the website |
| --- | --- | --- |
| 1 | `routes/adminRoute.js` has **no auth middleware** — every admin endpoint (approve vendor, advance order, revenue) is publicly callable. | Website still guards these behind the Admin role client-side; noted for the server team. |
| 2 | Product CRUD (`/add-product`, `/update-product`, `/delete-product`) and batch CRUD are **unauthenticated** (deliberate, per `batchRoute.js` comment). | Same — client-side role guard only. |
| 3 | Order has **no per-delivery-agent assignment field**. Every agent sees the same dispatch queue. | Delivery pages show a shared queue and say so. |
| 4 | **Disputes** exist only as Flutter UI (`admin/screens/dispute_screen.dart`) — no model, no route. | Built as a UI-complete page fed by mock data, clearly marked "no backend endpoint yet". |
| 5 | **Account deletion requests** are a client-side store only (`account_deletion_controller.dart`, `TODO(backend)`). | Same treatment. |
| 6 | **Forgot-password OTP** send/verify is `TODO(backend)`. | UI flow complete, service throws a documented `NOT_IMPLEMENTED`. |
| 7 | **Stock report** has no `.xlsx` endpoint (only order + vendor reports). | Card present, marked "Coming soon" exactly as the app does. |
| 8 | `ApiConfig.outlet*` constants point at a placeholder `/outlet/...` scheme that **does not match** the real `outletRoute.js` paths; the live datasource uses the real `/vsArogya/...` paths instead. | Website's API map uses the **real** paths only. |
| 9 | Typo in a live route: `PUT /delivered-prder/:id` (not `delivered-order`). | Preserved verbatim in `src/config/api.js`. |
| 10 | Two aliases for the same handler: `/outlet-stock` and `/outlet-addstock`; `/outlet-products/:id` (GET) and `/outlet-allstocks/:id` (POST). | Canonical one used; alias documented. |
| 11 | CORS is `app.use(cors())` (open); the `corsOptions` object with `credentials:true` is **declared but never applied**. | Browser cookie auth will not work as-is → website uses the **Bearer token**, which the app already prefers for exactly this reason. |
| 12 | `marketingAgent` model exists but the agent-register flow writes a `Vendor` with `role:"agent"`. | Website treats agents as Vendor-collection accounts. |
| 13 | Customer `Product` has no per-item stock in some read paths; `catalog.dart` keeps `decrementForOrder` as a documented no-op. | Website reads `stock` where present, degrades gracefully. |
| 14 | No named routes / deep links anywhere in the Flutter app. | The URL scheme in §8 is a website-side design decision. |

---

## 10. Website architecture plan

### Stack
- **React 19** + **Vite 7** (JavaScript — the backend is plain JS with no TypeScript types
  to reuse, and the Flutter models are hand-written, so TS would add ceremony without a
  shared contract to enforce)
- **React Router 7** (`createBrowserRouter`, nested layout routes)
- **Recharts** for the two analytics surfaces that genuinely need charts
- Hand-rolled CSS design system (CSS custom properties + BEM-ish class names). No UI kit —
  the brand palette and component vocabulary already exist in the Flutter app and are
  reproduced directly, which a generic component library would fight.

### Folder layout
```
website_vs/
├── index.html
├── vite.config.js
├── package.json
├── PROJECT_ANALYSIS.md          ← this file
├── README.md
├── public/
└── src/
    ├── main.jsx                 React root
    ├── app/
    │   ├── App.jsx              provider composition
    │   ├── router.jsx           the whole route tree (role-segmented)
    │   └── ProtectedRoute.jsx   role guard + redirect
    ├── config/
    │   └── api.js               ⭐ EVERY endpoint path, one place
    ├── constants/               roles, order statuses, categories, nav definitions
    ├── context/                 AuthContext, CartContext, ToastContext
    ├── services/                authService, productService, batchService,
    │                            orderService, outletService, deliveryService,
    │                            agentService, notificationService, reportService,
    │                            vendorService, couponService, bannerService,
    │                            + http.js (fetch wrapper, mock switch)
    ├── mock/                    centralised fixtures mirroring backend field names
    ├── hooks/                   useAsync, useDebounce, useTableControls, useToast…
    ├── utils/                   currency, dates, expiry tiers, formatters
    ├── components/
    │   ├── common/              Button, Badge, Card, Chip, Modal, Drawer, Tabs…
    │   ├── layout/              DashboardLayout, Sidebar, Topbar, StorefrontLayout
    │   ├── forms/               Field, Select, DateField, FileField, FormSection
    │   ├── tables/              DataTable (sort + paginate + empty/loading/error)
    │   └── feedback/            Spinner, EmptyState, ErrorState, Toast, ConfirmDialog
    ├── features/                cross-page domain widgets (batch table, expiry badge,
    │                            order timeline, stat tiles, product card…)
    ├── pages/
    │   ├── auth/  admin/  marketing/  vendor/  delivery/  outlet/  agent/
    └── styles/                  tokens.css, base.css, components.css, layout.css
```

### API abstraction (the integration seam)
```
component → hook → service (services/*.js) → http.js → config/api.js → backend
                              ↑
                    mock/*.js when USE_MOCK
```
- **No component ever calls `fetch`.** Every network shape lives in a service.
- `src/config/api.js` holds the base URL (`VITE_API_BASE_URL`, defaulting to the same
  Render host the Flutter app uses) and **every path**, transcribed verbatim from the
  route files — including the `delivered-prder` typo.
- `src/services/http.js` has one switch: `USE_MOCK`. Today it is `true`, so every service
  resolves from `src/mock/`. Flipping it to `false` (`VITE_USE_MOCK=false`) makes the same
  service functions issue real requests — **no component changes**.
- Auth uses the `Authorization: Bearer <token>` header, matching `AuthService.authToken`
  in the Flutter app, because the backend's CORS config cannot support cookie auth from a
  browser (§9 finding 11).

### Mock authentication
`src/mock/users.js` defines one demo account per role. The login page offers a **dev role
switcher** rendered only when `USE_MOCK` is true, isolated in
`src/pages/auth/DevRoleSwitcher.jsx`. Deleting that one file and flipping the flag is the
entire removal.

### Design direction
Desktop-first B2B healthcare console: 260 px sidebar for the four internal roles
(Admin / Marketing / Outlet / Delivery / Agent), top-nav storefront for Vendor.
Dense tables over card walls. The Flutter palette is reproduced exactly; spacing follows
the app's 4 pt rhythm and 10/12/16/20 px radius scale. Charts only on the two analytics
surfaces that already have them in the app.
