// =============================================================================
// Order vocabulary — the exact enum from server/model/orderModel.js:
//   ["Pending","Confirm Order","Shipped","Out for Delivery","Delivered","Cancelled"]
// =============================================================================

export const ORDER_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirm Order',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Pipeline order, used by timelines and the "next action" resolver. */
export const ORDER_FLOW = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

/** Marketing's own tab labels (lib/marketing/marketing_models.dart). */
export const MARKETING_PIPELINE = [
  { key: ORDER_STATUS.PENDING, label: 'New' },
  { key: ORDER_STATUS.CONFIRMED, label: 'Packing' },
  { key: ORDER_STATUS.SHIPPED, label: 'Ready' },
  { key: ORDER_STATUS.OUT_FOR_DELIVERY, label: 'Shipped' },
  { key: ORDER_STATUS.DELIVERED, label: 'Done' },
];

export const ORDER_STATUS_TONE = {
  [ORDER_STATUS.PENDING]: 'warning',
  [ORDER_STATUS.CONFIRMED]: 'info',
  [ORDER_STATUS.SHIPPED]: 'info',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'accent',
  [ORDER_STATUS.DELIVERED]: 'success',
  [ORDER_STATUS.CANCELLED]: 'danger',
};

/**
 * The action that advances an order, and which service call performs it.
 * Mirrors the four PUT endpoints admin/marketing use.
 */
export const NEXT_ACTION = {
  [ORDER_STATUS.PENDING]: { label: 'Accept order', transition: 'confirm' },
  [ORDER_STATUS.CONFIRMED]: { label: 'Mark shipped', transition: 'ship' },
  [ORDER_STATUS.SHIPPED]: { label: 'Out for delivery', transition: 'outForDelivery' },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: { label: 'Mark delivered', transition: 'deliver' },
};

export const PAYMENT_METHOD = { COD: 'COD', ONLINE: 'ONLINE' };

export const PAYMENT_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

export const APPROVAL_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
