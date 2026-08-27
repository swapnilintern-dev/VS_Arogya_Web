// =============================================================================
// Mock data for the surfaces that have NO backend endpoint yet (analysis §9):
// disputes and account-deletion requests. Both exist as Flutter UI only.
// =============================================================================

import { oid, int, daysAgo } from './seed';
import { ORDERS } from './orders';
import { VENDORS } from './users';

const REASONS = [
  ['Damaged consignment', 'Two vials of the cold-chain line arrived with broken seals.'],
  ['Short supply', 'Invoice lists 40 strips; only 28 were received at the counter.'],
  ['Wrong batch delivered', 'Batch on the pack does not match the batch on the invoice.'],
  ['Expiry too close', 'Received stock expires in 26 days; policy requires 90+.'],
  ['Payment not reflected', 'Razorpay debited the amount but the order still shows unpaid.'],
];

export const DISPUTES = REASONS.map(([reason, detail], i) => {
  const order = ORDERS[i * 3] || ORDERS[0];
  return {
    _id: oid('dp', i + 1),
    orderId: order.orderNo,
    orderRef: order._id,
    reason,
    detail,
    buyer: order.user.store_name,
    vendor: 'VS Arogya Distribution',
    amount: order.totalAmount,
    status: i === 0 ? 'open' : i === 1 ? 'awaiting-vendor' : i === 4 ? 'resolved' : 'open',
    openedAt: daysAgo(int(1, 21)),
    evidenceCount: int(1, 4),
    messages: [
      { fromVendor: false, author: order.user.contact_person_name, text: detail, at: daysAgo(int(2, 20)) },
      { fromVendor: true, author: 'VS Arogya Support', text: 'Thanks for flagging this. We have pulled the dispatch photos and are checking with the warehouse.', at: daysAgo(int(1, 10)) },
    ],
  };
});

export const DELETION_REQUESTS = [
  { kind: 'vendor', name: VENDORS[3].store_name, contact: VENDORS[3].mobile_no, reason: 'Closing the pharmacy at the end of this quarter.' },
  { kind: 'vendor', name: VENDORS[11].store_name, contact: VENDORS[11].mobile_no, reason: 'Switching to a different distributor.' },
  { kind: 'delivery', name: 'Rahul Gaikwad', contact: '9731000422', reason: 'Leaving the delivery team.' },
].map((r, i) => ({
  _id: oid('dr', i + 1),
  ...r,
  status: i === 2 ? 'approved' : 'pending',
  requestedAt: daysAgo(int(1, 30)),
}));

/** The delivery role's earnings panel (no backend field — UI figures only). */
export const RIDER_PROFILE = {
  name: 'Sagar More',
  phone: '9800000004',
  role: 'Delivery Partner',
  rating: 4.8,
  totalDeliveries: 1264,
  vehicle: { number: 'MH 12 QR 4417', type: 'Two-wheeler', verified: true },
};
