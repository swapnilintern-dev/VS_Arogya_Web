// =============================================================================
// Catalogue vocabulary — transcribed from the Flutter app.
// =============================================================================

/** kMedicineCategories, lib/marketing/marketing_models.dart */
export const MEDICINE_CATEGORIES = [
  'Lifesaving Injections',
  'Vaccines',
  'Medicine',
];

/** _vendorTypes, lib/vendor_registration_screen.dart */
export const VENDOR_TYPES = ['Shop / Pharmacy', 'Hospital / Clinic'];

/** _shopTypes */
export const SHOP_TYPES = [
  'Retail Pharmacy',
  'Wholesale Pharmacy',
  'Online Pharmacy',
  'Hospital Pharmacy',
  'Ayurvedic / Herbal Store',
  'Medical Equipment',
];

/** _gstStatuses */
export const GST_STATUSES = [
  'Registered (Regular)',
  'Registered (Composition)',
  'Unregistered',
  'Exempt',
];

/** kNotificationCategories, lib/notifications/notification_models.dart */
export const NOTIFICATION_CATEGORIES = [
  'New Medicine',
  'Stock Update',
  'Offer',
  'Discount',
  'Emergency',
  'General Announcement',
  'Health Awareness',
  'Festival Greetings',
  'Important Update',
  'Company News',
  'Maintenance',
  'Policy Update',
];

export const NOTIFICATION_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'];

/** kRedirectScreens — in-app destinations a campaign can deep-link to. */
export const NOTIFICATION_REDIRECTS = {
  '': 'Notification detail (default)',
  home: 'Home',
  products: 'Shop',
  offers: 'Offers & Discounts',
  orders: 'My Orders',
  cart: 'Cart',
  saved: 'Saved Items',
  profile: 'Profile',
};

/** Colour per notification category (categoryColor() in the Flutter app). */
export const NOTIFICATION_CATEGORY_COLOR = {
  'New Medicine': '#2E7D5E',
  'Stock Update': '#00897B',
  Offer: '#EF6C00',
  Discount: '#D81B60',
  Emergency: '#D32F2F',
  'Health Awareness': '#0288D1',
  'Festival Greetings': '#8E24AA',
  'Important Update': '#5E35B1',
  'Company News': '#3949AB',
  Maintenance: '#616161',
  'Policy Update': '#00695C',
  'General Announcement': '#4CAF82',
};

/** The default per-product reorder threshold on the backend. */
export const DEFAULT_LOW_THRESHOLD = 10;

/** Vendor-facing "buy now before it runs out" threshold (customer_models.dart). */
export const VENDOR_LOW_STOCK_THRESHOLD = 25;
