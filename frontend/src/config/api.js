// =============================================================================
// VS Arogya Web — API configuration
//
// SINGLE SOURCE OF TRUTH for the backend base URL and EVERY endpoint path.
// Mirrors lib/services/api_config.dart in the Flutter app, and the paths are
// transcribed VERBATIM from server/routes/*.js — including the two quirks
// noted in PROJECT_ANALYSIS.md §9:
//   • `delivered-prder` really is spelled that way on the server.
//   • `/outlet-stock` and `/outlet-addstock` are aliases for one handler.
//
// No component may build a URL. Services import from here; that is the whole
// integration seam.
// =============================================================================

/** The hosted backend — the SAME server the Flutter app talks to. */
const DEFAULT_BASE_URL = 'https://backend-new-0ady.onrender.com';

/**
 * Backend origin. Override with VITE_API_BASE_URL in .env (see .env.example),
 * e.g. http://localhost:3000 to develop against a locally running backend
 * (the backend is its own repo: swapnilintern-dev/backend_new).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

/** Every route in server/index.js is mounted under this prefix. */
export const API_PREFIX = '/vsArogya';

/** Absolute URL for an API path. */
export const apiUrl = (path) => `${API_BASE_URL}${API_PREFIX}${path}`;

// -----------------------------------------------------------------------------
// ENDPOINTS — grouped exactly like self/server/routes/
// -----------------------------------------------------------------------------

export const ENDPOINTS = {
  // routes/userRoute.js -------------------------------------------------------
  auth: {
    login: '/login',                                  // POST  {mobile_no, password}
    logout: '/logout',                                // POST  (auth)
    registerVendor: '/register-vendor',               // POST  multipart KYC
    deleteAccount: '/vendor-delete',                  // DELETE (auth)
    // Change password (signed in, sends currentPassword) AND the last step of
    // forgot-password (signed in by OTP, no currentPassword).
    updatePassword: '/update-password',               // PUT   (auth) {newPassword, currentPassword?}
  },

  // routes/eotpRoute.js — email one-time-code sign-in -------------------------
  // /eotp always answers 200 so it cannot be used to discover which addresses
  // are registered; /eotp-verify returns the SAME body as /login (plus `outlet`
  // for an outlet account).
  emailOtp: {
    send: '/eotp',                                    // POST {email}
    verify: '/eotp-verify',                           // POST {email, otp}
  },
  addresses: {
    list: '/addresses',                               // GET    (auth)
    create: '/addresses',                             // POST   (auth)
    update: (addressId) => `/addresses/${addressId}`, // PUT    (auth)
    remove: (addressId) => `/addresses/${addressId}`, // DELETE (auth)
  },

  // routes/bulkUploadRoute.js -------------------------------------------------
  // Spreadsheet import straight into the catalogue. Auth + role "marketing" or
  // "admin"; multipart with ONE field named `file`.
  bulk: {
    uploadProducts: '/bulk-upload',                   // POST (auth, marketing|admin) multipart `file`
  },

  // routes/postRouter.js ------------------------------------------------------
  products: {
    all: '/all-products',                             // GET
    add: '/add-product',                              // POST   multipart
    update: (id) => `/update-product/${id}`,          // PUT    multipart
    remove: (id) => `/delete-product/${id}`,          // DELETE
    share: (id) => `/share-prod/${id}`,               // GET    (auth)
    save: (id) => `/save-prod/${id}`,                 // POST   (auth)
    saved: '/all-saved',                              // GET    (auth)
  },

  // routes/batchRoute.js ------------------------------------------------------
  batches: {
    ofProduct: (productId) => `/product/${productId}/batches`,             // GET
    availableOfProduct: (productId) => `/product/${productId}/available-batches`, // GET FEFO
    allocatePreview: '/allocate-preview',                                  // POST (non-mutating)
    create: (productId) => `/product/${productId}/batches`,                // POST
    update: (batchId) => `/batch/${batchId}`,                              // PUT
    remove: (batchId) => `/batch/${batchId}`,                              // DELETE
  },

  // routes/cartRoute.js (all auth) -------------------------------------------
  cart: {
    get: '/getCart-product',                          // GET
    add: (productId) => `/add-cart/${productId}`,     // POST
    increase: (productId) => `/increase-cart-item/${productId}`, // POST
    decrease: (productId) => `/dec-cart-itm/${productId}`,       // POST
    remove: (productId) => `/remove-cart-item/${productId}`,     // DELETE
    clear: '/clear-cart',                             // POST
  },

  // routes/orderRoute.js (all auth) ------------------------------------------
  orders: {
    place: '/place-order',                            // POST
    placeSingle: (productId) => `/place-single-ord/${productId}`, // POST
    mine: '/get-order',                               // GET
    cancel: (id) => `/cancel-order/${id}`,            // PUT
  },

  // routes/adminRoute.js ------------------------------------------------------
  // NOTE: these carry no auth middleware on the server today (analysis §9.1).
  admin: {
    pendingVendors: '/pending-vendor',                // GET
    approveVendor: (id) => `/approval-mail/${id}`,    // PUT  (emails credentials)
    rejectVendor: (id) => `/reject-vendor/${id}`,     // PUT
    allOrders: '/all-orders',                         // GET
    singleOrder: (id) => `/single-order/${id}`,       // GET  → { order } populated
    confirmOrder: (id) => `/confirm-order/${id}`,     // PUT  Pending → Confirm Order
    shipOrder: (id) => `/shipped-order/${id}`,        // PUT  Confirm Order → Shipped
    outForDelivery: (id) => `/outof-delivery/${id}`,  // PUT  Shipped → Out for Delivery
    deliverOrder: (id) => `/delivered-prder/${id}`,   // PUT  (server spelling — do not "fix")
    allVendors: '/all-vendors',                       // GET
    activeVendors: '/active-vendors',                 // GET
    totalRevenue: '/total-revenue',                   // GET
  },

  // routes/paymentRoute.js (auth) --------------------------------------------
  payment: {
    create: (orderId) => `/create-payment/${orderId}`, // POST
    verify: '/verify-payment',                         // POST
  },

  // routes/bannerRoute.js -----------------------------------------------------
  banners: {
    list: '/promo-banners',                            // GET
    create: '/promo-banners',                          // POST multipart `image`
    remove: (id) => `/promo-banners/${id}`,            // DELETE
  },

  // routes/couponRoute.js -----------------------------------------------------
  coupons: {
    list: '/coupons',                                  // GET  (active, non-expired)
    create: '/coupons',                                // POST
    toggle: (code) => `/coupons/${code}/toggle`,       // PUT
    remove: (code) => `/coupons/${code}`,              // DELETE
  },

  // routes/invoiceRoute.js (auth) --------------------------------------------
  invoice: {
    preview: (orderId) => `/prev-invoice/${orderId}`,  // GET (auth) → 302 → hosted PDF
  },

  // routes/deliveryRoute.js ---------------------------------------------------
  delivery: {
    createAgent: '/agent-create',                      // POST (server generates password)
    agentLogin: '/agent-login',                        // POST {mobile, password}
    paymentLink: (orderId) => `/delivery/payment-link/${orderId}`,   // POST (auth, role delivery)
    paymentStatus: (orderId) => `/delivery/payment-status/${orderId}`, // GET  (auth)
  },

  // routes/manualRoute.js -----------------------------------------------------
  manual: {
    addToVendorCart: (vendorId, productId) => `/manual-cart/${vendorId}/${productId}`, // POST, 1 unit
    placeOrder: (vendorId) => `/manual-order/${vendorId}`,                             // POST
  },

  // routes/xlshRoute.js -------------------------------------------------------
  reports: {
    orders: '/order-report',                           // GET .xlsx
    vendors: '/vendor-report',                         // GET .xlsx
    // NOTE: no stock-report endpoint exists (analysis §9.7).
  },

  // routes/outletRoute.js -----------------------------------------------------
  outlet: {
    register: '/outlet-register',                      // POST (public)
    login: '/outlet-login',                            // POST (public)
    list: '/outlets',                                  // GET  ?pincode= (auth)
    assignStock: '/outlet-stock',                      // POST (auth) — alias: /outlet-addstock
    assignStockAlias: '/outlet-addstock',
    profile: (id) => `/outlet-profile/${id}`,          // GET  (auth)
    products: (id) => `/outlet-products/${id}`,        // GET  (auth)
    orders: (id) => `/outlet-orders/${id}`,            // GET  (auth)
    razorpayOrder: (orderId) => `/outlet/orders/${orderId}/razorpay`, // POST (auth)
    verifyPayment: (orderId) => `/outlet/orders/${orderId}/verify`,   // POST (auth)
    paymentLink: (orderId) => `/outlet/orders/${orderId}/payment`,    // POST (auth)
    orderStatus: (orderId) => `/outlet/orders/${orderId}/status`,     // GET  (auth)
    addToCart: '/outlet/add-cart',                     // POST (auth)
    cartSummary: '/outlet/cart-summary',               // GET  (auth)
    clearCart: '/outlet/clear-cart',                   // POST (auth)
    availableBatches: (productId) => `/outlet/product/${productId}/available-batches`, // GET (auth)
    allocatePreview: '/outlet/allocate-preview',       // POST (auth, non-mutating)
    bill: '/outlet/bill',                              // POST (auth) — POS billing
    registerVendor: '/outlet/register-vendor',         // POST (auth) JSON, no uploads
    manualOrder: (id) => `/outlet/manual-order/${id}`, // POST (auth)
    orderHistory: '/outlet/order-history',             // GET  (auth)
  },

  // routes/agentRoute.js ------------------------------------------------------
  agent: {
    register: '/agent-register',                       // POST (auth) — marketing registers
    login: '/area-agent-login',                        // POST (fallback; normally /login)
    pincodeVendors: (agentId) => `/pin-vendors/${agentId}`, // POST
    pincodeOrders: (agentId) => `/pin-orders/${agentId}`,   // POST
    profile: (agentId) => `/agent-profile/${agentId}`,      // GET
  },

  // routes/notificationRoute.js ----------------------------------------------
  notifications: {
    meta: '/notifications/meta',                       // GET  (auth)
    registerDeviceToken: '/notifications/device-token',// POST (auth)
    updateDeviceToken: '/notifications/device-token',  // PUT  (auth)
    deleteDeviceToken: '/notifications/device-token',  // DELETE (auth)
    settings: '/notifications/settings',               // GET  (auth)
    preferences: '/notifications/preferences',         // PUT  (auth)

    inbox: '/notifications/inbox',                     // GET  (auth)
    unreadCount: '/notifications/inbox/unread-count',  // GET  (auth)
    markAllRead: '/notifications/inbox/read-all',      // POST (auth)
    markRead: (id) => `/notifications/inbox/${id}/read`,           // POST (auth)
    markDelivered: (id) => `/notifications/inbox/${id}/delivered`, // POST (auth)
    markOpened: (id) => `/notifications/inbox/${id}/opened`,       // POST (auth)
    removeInboxItem: (id) => `/notifications/inbox/${id}`,         // DELETE (auth)

    // --- Per-user inbox (controller/createNotificationController.js) --------
    // Transactional notifications addressed to ONE account. Separate paths and
    // a separate collection from the broadcast campaigns below.
    userCreate: '/createNotification',                 // POST (auth) {recipientId, recipientType, title, message, type?, referenceId?, data?}
    userList: '/get-notification',                     // GET  (auth) → { count, notifications }
    userUnread: '/unread-notification',                // GET  (auth) → { count }
    userMarkRead: (id) => `/mark-read-notification/${id}`, // PATCH (auth)
    userMarkAllRead: '/mark-all-read',                 // POST (auth)

    audience: '/notifications/audience',               // GET  (marketing)
    list: '/notifications',                            // GET  (marketing)
    create: '/notifications',                          // POST (marketing, multipart ok)
    update: (id) => `/notifications/${id}`,            // PUT  (marketing)
    remove: (id) => `/notifications/${id}`,            // DELETE (marketing)
    send: (id) => `/notifications/${id}/send`,         // POST (marketing)
    retry: (id) => `/notifications/${id}/retry`,       // POST (marketing)
    duplicate: (id) => `/notifications/${id}/duplicate`, // POST (marketing)
    stats: (id) => `/notifications/${id}/stats`,       // GET  (marketing)
    detail: (id) => `/notifications/${id}`,            // GET  (marketing)
  },
};

export default ENDPOINTS;
