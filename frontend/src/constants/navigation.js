// =============================================================================
// Sidebar / top-nav definitions per role. One place, so a route added to the
// router and a link added to a shell can never drift.
// =============================================================================

import { ROLES } from './roles';

export const NAV = {
  [ROLES.ADMIN]: [
    { section: 'Overview', items: [
      { to: '/admin', label: 'Dashboard', icon: 'grid', end: true },
      { to: '/admin/analytics', label: 'Analytics', icon: 'chart' },
    ]},
    { section: 'Marketplace', items: [
      { to: '/admin/vendors', label: 'Vendors', icon: 'store' },
      { to: '/admin/orders', label: 'Orders', icon: 'receipt' },
      { to: '/admin/products', label: 'Products', icon: 'pill' },
    ]},
    { section: 'People', items: [
      { to: '/admin/users', label: 'User management', icon: 'users' },
      { to: '/admin/delivery', label: 'Delivery agents', icon: 'truck' },
      { to: '/admin/deletion-requests', label: 'Deletion requests', icon: 'trash' },
    ]},
    { section: 'Support', items: [
      { to: '/admin/disputes', label: 'Disputes', icon: 'alert' },
      { to: '/admin/settings', label: 'Settings', icon: 'settings' },
    ]},
  ],

  [ROLES.MARKETING]: [
    { section: 'Overview', items: [
      { to: '/marketing', label: 'Dashboard', icon: 'grid', end: true },
    ]},
    { section: 'Inventory', items: [
      { to: '/marketing/products', label: 'Medicines', icon: 'pill' },
      { to: '/marketing/batches', label: 'Batch overview', icon: 'layers' },
    ]},
    { section: 'Fulfilment', items: [
      { to: '/marketing/orders', label: 'Orders', icon: 'receipt' },
      { to: '/marketing/orders/manual', label: 'Create manual order', icon: 'plus' },
    ]},
    { section: 'Network', items: [
      { to: '/marketing/outlets', label: 'Outlets', icon: 'store' },
      { to: '/marketing/outlets/assign-stock', label: 'Assign stock', icon: 'send' },
      { to: '/marketing/agents', label: 'Area agents', icon: 'pin' },
    ]},
    { section: 'Growth', items: [
      { to: '/marketing/coupons', label: 'Coupons', icon: 'tag' },
      { to: '/marketing/banners', label: 'Promo banners', icon: 'image' },
      { to: '/marketing/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/marketing/reports', label: 'Reports', icon: 'download' },
    ]},
  ],

  [ROLES.DELIVERY]: [
    { section: 'Work', items: [
      { to: '/delivery', label: 'Task queue', icon: 'grid', end: true },
      { to: '/delivery/history', label: 'My deliveries', icon: 'receipt' },
      { to: '/delivery/profile', label: 'Profile', icon: 'user' },
    ]},
  ],

  [ROLES.OUTLET]: [
    { section: 'Counter', items: [
      { to: '/outlet', label: 'Dashboard', icon: 'grid', end: true },
      { to: '/outlet/billing', label: 'Billing (POS)', icon: 'receipt' },
      { to: '/outlet/orders/new', label: 'Manual order', icon: 'plus' },
    ]},
    { section: 'Inventory', items: [
      { to: '/outlet/stock', label: 'Stock', icon: 'layers' },
    ]},
    { section: 'Records', items: [
      { to: '/outlet/orders', label: 'Orders', icon: 'list' },
      { to: '/outlet/profile', label: 'Outlet profile', icon: 'store' },
    ]},
  ],

  [ROLES.AGENT]: [
    { section: 'Monitor', items: [
      { to: '/agent', label: 'Pincode orders', icon: 'grid', end: true },
      { to: '/agent/profile', label: 'Profile', icon: 'user' },
    ]},
  ],
};

/** Vendor uses a storefront top-nav rather than a sidebar. */
export const VENDOR_NAV = [
  { to: '/shop', label: 'Home', end: true },
  { to: '/shop/orders', label: 'My orders' },
  { to: '/shop/saved', label: 'Saved' },
];
