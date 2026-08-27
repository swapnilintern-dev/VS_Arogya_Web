// =============================================================================
// Mock coupons, promo banners and notification campaigns.
// Shapes from couponModel.js, bannerModel.js and notificationModel.js.
// =============================================================================

import { oid, int, daysAgo, daysAhead } from './seed';
import { NOTIFICATION_CATEGORIES } from '../constants/catalog';
import { DEMO_ACCOUNTS } from './users';

export const COUPONS = [
  { code: 'BULK20', description: '20% off on orders above ₹10,000', percentOff: 20, maxDiscount: 4000, redemptions: 184, active: true, expiresAt: daysAhead(41) },
  { code: 'FIRSTBUY', description: 'Flat 12% off on a vendor’s first order', percentOff: 12, maxDiscount: 1500, redemptions: 96, active: true, expiresAt: daysAhead(120) },
  { code: 'VACCINE10', description: '10% off across the vaccines category', percentOff: 10, maxDiscount: 2500, redemptions: 47, active: true, expiresAt: daysAhead(18) },
  { code: 'MONSOON15', description: '15% off on OTC & wellness range', percentOff: 15, maxDiscount: 3000, redemptions: 233, active: false, expiresAt: daysAhead(64) },
  { code: 'DIWALI25', description: 'Festive 25% off, capped at ₹5,000', percentOff: 25, maxDiscount: 5000, redemptions: 511, active: false, expiresAt: daysAgo(96) },
  { code: 'COLDCHAIN8', description: '8% off on cold-chain products', percentOff: 8, maxDiscount: 1200, redemptions: 62, active: true, expiresAt: daysAhead(75) },
].map((c, i) => ({
  _id: oid('c', i + 1),
  ...c,
  expired: new Date(c.expiresAt) < new Date(),
  createdAt: daysAgo(int(20, 300)),
}));

export const BANNERS = [
  { tag: 'BULK OFFER', title: 'Flat 20% OFF on orders above ₹10,000', ctaLabel: 'Shop now', startColor: '#4CAF82', endColor: '#2E7D5E', categoryId: '', active: true },
  { tag: 'COLD CHAIN', title: 'Vaccines delivered at 2–8°C, guaranteed', ctaLabel: 'View vaccines', startColor: '#0288D1', endColor: '#01579B', categoryId: 'Vaccines', active: true },
  { tag: 'NEW ARRIVAL', title: 'Lifesaving injections now in stock', ctaLabel: 'Explore', startColor: '#8E24AA', endColor: '#4A148C', categoryId: 'Lifesaving Injections', active: true },
  { tag: 'RESTOCKED', title: 'Fast-moving essentials back on the shelf', ctaLabel: 'Browse', startColor: '#EF6C00', endColor: '#B23C00', categoryId: 'Medicine', active: false },
].map((b, i) => ({
  _id: oid('bn', i + 1),
  ...b,
  image: { url: '', publicId: '' },
  createdAt: daysAgo(int(5, 180)),
}));

const CAMPAIGN_SPECS = [
  ['Insulin Glargine back in stock', 'Cold-chain restock complete', 'Stock Update', 'High', 'sent'],
  ['Monsoon essentials — 15% off', 'Limited to the OTC range', 'Offer', 'Normal', 'sent'],
  ['New: Typhoid Conjugate Vaccine', 'Now orderable across all pincodes', 'New Medicine', 'Normal', 'sent'],
  ['Scheduled maintenance tonight', 'Ordering pauses 1:00–2:00 AM IST', 'Maintenance', 'Critical', 'sent'],
  ['Updated drug-license policy', 'Renewals now required 30 days ahead', 'Policy Update', 'High', 'sent'],
  ['Diwali greetings from VS Arogya', 'Wishing your team a bright festival', 'Festival Greetings', 'Low', 'sent'],
  ['World Health Day awareness', 'Free BP screening camps this week', 'Health Awareness', 'Normal', 'draft'],
  ['Q3 catalogue expansion', 'Over 40 new SKUs going live', 'Company News', 'Normal', 'scheduled'],
  ['Emergency: batch recall B2417', 'Stop dispensing immediately', 'Emergency', 'Critical', 'failed'],
];

export const CAMPAIGNS = CAMPAIGN_SPECS.map(([title, subtitle, category, priority, status], i) => {
  const targeted = int(180, 320);
  const tokens = Math.round(targeted * 0.86);
  const sent = status === 'sent' ? Math.round(tokens * 0.95) : status === 'failed' ? Math.round(tokens * 0.2) : 0;
  const delivered = Math.round(sent * 0.93);
  return {
    _id: oid('n', i + 1),
    title,
    subtitle,
    message:
      `${subtitle}. Open the VS Arogya app to see the full details and place your order. ` +
      'Reach out to your area agent if you need help.',
    category,
    priority,
    buttonText: status === 'draft' ? '' : 'View details',
    redirectScreen: ['products', 'offers', 'orders', '', 'home'][i % 5],
    deepLink: '',
    imageUrl: '',
    bannerImage: { url: '', publicId: '' },
    icon: '',
    expiryDate: daysAhead(int(10, 90)),
    pinned: i === 3 || i === 8,
    status,
    audience: 'vendors',
    scheduledAt: status === 'scheduled' ? daysAhead(2) : null,
    sentAt: status === 'sent' ? daysAgo(int(1, 60)) : null,
    sender: { id: DEMO_ACCOUNTS[1]._id, name: 'Meera Kulkarni', role: 'marketing' },
    stats: {
      targeted,
      tokens,
      sent,
      delivered,
      failed: status === 'failed' ? Math.round(tokens * 0.8) : Math.round(sent * 0.04),
      opened: Math.round(delivered * 0.41),
      read: Math.round(delivered * 0.58),
      retryCount: status === 'failed' ? 2 : 0,
    },
    lastError: status === 'failed' ? 'FCM rejected 214 tokens (SenderId mismatch)' : '',
    createdAt: daysAgo(int(2, 90)),
  };
});

/** A vendor's notification-center rows: receipts joined with their campaign. */
export const NOTIFICATION_INBOX = CAMPAIGNS
  .filter((c) => c.status === 'sent')
  .map((c, i) => ({
    _id: oid('nr', i + 1),
    notificationId: c._id,
    title: c.title,
    subtitle: c.subtitle,
    message: c.message,
    category: c.category,
    priority: c.priority,
    buttonText: c.buttonText,
    redirectScreen: c.redirectScreen,
    deepLink: c.deepLink,
    imageUrl: c.imageUrl,
    bannerImage: c.bannerImage.url,
    icon: c.icon,
    pinned: c.pinned,
    expiryDate: c.expiryDate,
    sentAt: c.sentAt,
    receivedAt: c.sentAt,
    read: i > 1,
    opened: i > 2,
    senderName: c.sender.name,
  }));

export const AUDIENCE_SUMMARY = {
  eligibleVendors: 268,
  reachableVendors: 231,
  pushConfigured: true,
  warning: '',
};
