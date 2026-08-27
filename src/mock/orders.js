// =============================================================================
// Mock orders — server/model/orderModel.js, including the batch `allocations`
// breakdown the FEFO engine writes at order creation.
// =============================================================================

import { oid, int, chance, daysAgo, pick } from './seed';
import { PRODUCTS, batchesOfProduct } from './products';
import { VENDORS, DEMO_ACCOUNTS, DEMO_OUTLET } from './users';
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '../constants/orders';

const APPROVED_VENDORS = VENDORS.filter((v) => v.approvalStatus === 'Approved');
const BUYERS = [DEMO_ACCOUNTS[2], ...APPROVED_VENDORS];

/** Distribution tuned so every pipeline tab has rows to look at. */
const STATUS_PLAN = [
  ...Array(9).fill(ORDER_STATUS.PENDING),
  ...Array(7).fill(ORDER_STATUS.CONFIRMED),
  ...Array(6).fill(ORDER_STATUS.SHIPPED),
  ...Array(5).fill(ORDER_STATUS.OUT_FOR_DELIVERY),
  ...Array(18).fill(ORDER_STATUS.DELIVERED),
  ...Array(3).fill(ORDER_STATUS.CANCELLED),
];

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

/** The server stores an `amountWord` on every order; a short form is enough here. */
function amountInWords(n) {
  const value = Math.round(Number(n) || 0);
  if (value < 10) return `${ONES[value] || 'Zero'} Rupees Only`;
  if (value < 100000) return `Rupees ${value.toLocaleString('en-IN')} Only`;
  return `Rupees ${(value / 100000).toFixed(2)} Lakh Only`;
}

function buildOrderItems(count) {
  const chosen = [];
  const used = new Set();
  for (let i = 0; i < count; i += 1) {
    let p = pick(PRODUCTS);
    let guard = 0;
    while (used.has(p._id) && guard < 8) { p = pick(PRODUCTS); guard += 1; }
    used.add(p._id);

    const quantity = int(1, 24);
    const lots = batchesOfProduct(p._id);
    const front = lots[0];

    // FEFO breakdown: split across the front lot and, when it can't cover the
    // line, the next one — the shape server/utils/inventory.js writes.
    const allocations = [];
    let left = quantity;
    for (const lot of lots) {
      if (left <= 0) break;
      const take = Math.min(left, Math.max(1, Math.floor(lot.available_quantity / 3)) || left);
      allocations.push({
        batch: lot._id,
        batch_number: lot.batch_number,
        expiry_date: lot.expiry_date,
        quantity: take,
      });
      left -= take;
    }
    if (left > 0 && allocations.length) allocations[allocations.length - 1].quantity += left;

    chosen.push({
      product: { ...p },
      quantity,
      orderPrice: p.price,
      freeQty: chance(0.12) ? int(1, 3) : 0,
      batch_no: front?.batch_number || p.batch_no,
      exp_date: front?.expiry_date || p.exp_date,
      allocations,
    });
  }
  return chosen;
}

function buildOrder(i) {
  const status = STATUS_PLAN[i % STATUS_PLAN.length];
  // Weighted so a handful of vendors order repeatedly and others order once —
  // a flat i % BUYERS.length gives every vendor an identical count, which makes
  // the repeat-buyer rate read as a meaningless 100%.
  const buyer = BUYERS[i < 20 ? i % 6 : (i - 20) % BUYERS.length];
  const items = buildOrderItems(int(1, 5));
  const total = items.reduce((s, it) => s + it.orderPrice * it.quantity, 0);
  const placedDaysAgo =
    status === ORDER_STATUS.PENDING ? int(0, 2)
      : status === ORDER_STATUS.CONFIRMED ? int(1, 4)
        : status === ORDER_STATUS.SHIPPED ? int(2, 6)
          : status === ORDER_STATUS.OUT_FOR_DELIVERY ? int(2, 5)
            : int(3, 90);

  const online = i % 3 !== 0;
  const paid = online && (status === ORDER_STATUS.DELIVERED || i % 4 === 0);
  // Every 6th order is a marketing-placed phone order; every 9th came from an outlet.
  const isManual = i % 6 === 0;
  const isOutlet = i % 9 === 4;

  return {
    _id: oid('o', i + 100),
    orderNo: `VSA-${String(48000 + i)}`,
    user: {
      _id: buyer._id,
      store_name: buyer.store_name,
      contact_person_name: buyer.contact_person_name,
      mobile_no: buyer.mobile_no,
      email: buyer.email,
      city: buyer.city,
    },
    outlet: isOutlet ? DEMO_OUTLET._id : undefined,
    orderItems: items,
    shippingAddress: {
      address: buyer.full_address || `${int(2, 90)} Market Yard`,
      city: buyer.city,
      state: buyer.state,
      pincode: buyer.pin_code,
      country: 'India',
      phoneNo: buyer.mobile_no,
    },
    paymentMethod: online ? PAYMENT_METHOD.ONLINE : PAYMENT_METHOD.COD,
    paymentInfo: {
      razorpay_id: paid ? `pay_${oid('r', i).slice(0, 14)}` : undefined,
      razorpay_orderId: online ? `order_${oid('r', i).slice(0, 14)}` : undefined,
      status: paid ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.PENDING,
    },
    paidAt: paid ? daysAgo(placedDaysAgo - 0.2) : undefined,
    totalAmount: Math.round(total * 100) / 100,
    orderStatus: status,
    deliveredAt: status === ORDER_STATUS.DELIVERED ? daysAgo(Math.max(0, placedDaysAgo - 2)) : undefined,
    invoice: status === ORDER_STATUS.PENDING || status === ORDER_STATUS.CANCELLED
      ? undefined
      : { _id: oid('i', i), invoiceNumber: `INV-2026-${String(3100 + i)}` },
    amountWord: amountInWords(total),
    orderType: 'byApp',
    source: isManual ? 'MANUAL_BY_MARKETING' : undefined,
    createdBy: isManual ? DEMO_ACCOUNTS[1]._id : undefined,
    clientOrderId: isManual ? `cli-${oid('c', i).slice(0, 12)}` : undefined,
    createdAt: daysAgo(placedDaysAgo),
    updatedAt: daysAgo(Math.max(0, placedDaysAgo - 1)),
  };
}

export const ORDERS = Array.from({ length: 48 }, (_, i) => buildOrder(i))
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export const orderById = (id) => ORDERS.find((o) => o._id === id);

/** GET /total-revenue — realised revenue, i.e. Delivered orders only. */
export const TOTAL_REVENUE = ORDERS
  .filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED)
  .reduce((s, o) => s + o.totalAmount, 0);

// -----------------------------------------------------------------------------
// INVOICES — server/model/invoiceModel.js
// -----------------------------------------------------------------------------

export const INVOICES = ORDERS.filter((o) => o.invoice).map((o, i) => {
  const subtotal = Math.round((o.totalAmount / 1.12) * 100) / 100;
  const tax = Math.round((o.totalAmount - subtotal) * 100) / 100;
  return {
    _id: o.invoice._id,
    invoiceNumber: o.invoice.invoiceNumber,
    order: o._id,
    vendor: o.user._id,
    pdfUrl: '',
    subtotal,
    cgst: Math.round((tax / 2) * 100) / 100,
    sgst: Math.round((tax / 2) * 100) / 100,
    igst: 0,
    grandTotal: o.totalAmount,
    generatedAt: o.createdAt,
    __i: i,
  };
});

export const invoiceForOrder = (orderId) => INVOICES.find((inv) => inv.order === orderId);
