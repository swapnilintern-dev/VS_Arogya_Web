// =============================================================================
// Notifications — routes/notificationRoute.js (all authenticated; the
// marketing panel additionally requires the marketing role in the JWT).
//
// The server shapes campaigns and inbox items with `id` (not `_id`); the
// service mirrors it onto `_id` so lists key the same way as every other
// collection on the site.
//
//   GET  /notifications                → { notifications, page, limit, total, hasMore }
//   GET  /notifications/:id            → { notification }
//   GET  /notifications/:id/stats      → { stats }
//   GET  /notifications/audience       → { eligibleVendors, reachableVendors, pushConfigured, warning? }
//   POST /notifications (multipart ok) → { notification }   + sendNow=true broadcasts immediately
//   PUT  /notifications/:id            → { notification }
//   POST /notifications/:id/send|retry|duplicate
//   DELETE /notifications/:id
//   GET  /notifications/inbox          → { notifications }
//   GET  /notifications/inbox/unread-count → { unread }
//   POST /notifications/inbox/read-all, /:id/read ; DELETE /notifications/inbox/:id
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, del, patch, request } from './http';

const withId = (n) => (n ? { ...n, _id: n._id || n.id } : n);
const listWithIds = (rows) => (rows || []).map(withId);

// --- Marketing broadcast panel ----------------------------------------------

export async function listCampaigns() {
  const body = await get(`${ENDPOINTS.notifications.list}?limit=100`);
  return listWithIds(body?.notifications);
}

export async function getCampaign(id) {
  const body = await get(ENDPOINTS.notifications.detail(id));
  return withId(body?.notification || null);
}

export async function getAudienceSummary() {
  const body = await get(ENDPOINTS.notifications.audience);
  return {
    eligibleVendors: body?.eligibleVendors ?? 0,
    reachableVendors: body?.reachableVendors ?? 0,
    pushConfigured: body?.pushConfigured ?? true,
    warning: body?.warning || '',
  };
}

export async function createCampaign(fields, bannerFile) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') form.append(k, v); });
  if (bannerFile) form.append('bannerImage', bannerFile);
  const body = await request(ENDPOINTS.notifications.create, { method: 'POST', body: form, timeoutMs: 90000 });
  return withId(body?.notification || body);
}

export async function updateCampaign(id, fields) {
  const body = await put(ENDPOINTS.notifications.update(id), fields);
  return withId(body?.notification || body);
}

/** Send / retry / duplicate answer with the campaign when they have one, else re-read it. */
async function campaignAfter(promise, id) {
  const body = await promise;
  if (body?.notification) return withId(body.notification);
  return getCampaign(body?.id || id);
}

export const sendCampaign = (id) => campaignAfter(post(ENDPOINTS.notifications.send(id), undefined, { timeoutMs: 90000 }), id);
export const retryCampaign = (id) => campaignAfter(post(ENDPOINTS.notifications.retry(id), undefined, { timeoutMs: 90000 }), id);
export const duplicateCampaign = (id) => campaignAfter(post(ENDPOINTS.notifications.duplicate(id)), id);

export async function deleteCampaign(id) {
  return del(ENDPOINTS.notifications.remove(id));
}

export async function getCampaignStats(id) {
  const body = await get(ENDPOINTS.notifications.stats(id));
  return body?.stats || null;
}

// --- Vendor notification centre ---------------------------------------------

export async function listInbox() {
  const body = await get(`${ENDPOINTS.notifications.inbox}?limit=100`);
  return listWithIds(body?.notifications).map((n) => ({ ...n, source: 'broadcast' }));
}

export async function getUnreadCount() {
  const body = await get(ENDPOINTS.notifications.unreadCount);
  return Number(body?.unread ?? 0);
}

export async function markRead(id) {
  await post(ENDPOINTS.notifications.markRead(id));
  return listInbox();
}

export async function markAllRead() {
  await post(ENDPOINTS.notifications.markAllRead);
  return listInbox();
}

export async function deleteInboxItem(id) {
  await del(ENDPOINTS.notifications.removeInboxItem(id));
  return listInbox();
}

// --- Per-user inbox ----------------------------------------------------------
//
// controller/createNotificationController.js — transactional notifications
// addressed to ONE account (order placed, payment, vendor approved). A separate
// collection and separate routes from the broadcast campaigns above, so a
// vendor's notification centre merges the two.

/** The signed-in account's own notifications, newest first (server caps at 100). */
export async function listUserNotifications() {
  const body = await get(ENDPOINTS.notifications.userList);
  return (body?.notifications || []).map((n) => ({ ...n, source: 'direct' }));
}

export async function getUserUnreadCount() {
  const body = await get(ENDPOINTS.notifications.userUnread);
  return Number(body?.count ?? 0);
}

export async function markUserNotificationRead(id) {
  return patch(ENDPOINTS.notifications.userMarkRead(id));
}

export async function markAllUserNotificationsRead() {
  return post(ENDPOINTS.notifications.userMarkAllRead);
}

/**
 * Sends one notification to one account — what staff use to reach a single
 * vendor/outlet rather than broadcasting to everyone.
 *
 * `recipientType` is one of vendor | outlet | admin | deliveryAgent and `type`
 * one of the server's enum values (defaults to GENERAL).
 */
export async function createUserNotification({ recipientId, recipientType, title, message, type, referenceId, data }) {
  const body = await post(ENDPOINTS.notifications.userCreate, {
    recipientId, recipientType, title, message,
    ...(type ? { type } : {}),
    ...(referenceId ? { referenceId } : {}),
    ...(data ? { data } : {}),
  });
  return body?.notification || body;
}

// --- The two inboxes, merged -------------------------------------------------
//
// A vendor has notifications from two systems: marketing BROADCASTS (receipts,
// with a category and a sender) and DIRECT messages about their own orders. The
// notification centre shows one list, so the merge and the shared shape live
// here rather than in the page.

/** One row of the notification centre, whichever system produced it. */
const unify = (n) => (n.source === 'direct'
  ? {
    key: `direct:${n._id}`,
    id: n._id,
    source: 'direct',
    title: n.title,
    subtitle: '',
    message: n.message,
    // The server's `type` enum (ORDER_SHIPPED, PAYMENT_SUCCESS, …) reads as the
    // category for a direct message.
    category: String(n.type || 'GENERAL').replace(/_/g, ' ').toLowerCase(),
    priority: 'Normal',
    pinned: false,
    read: !!n.isRead,
    at: n.createdAt,
    senderName: 'VS Arogya',
    buttonText: '',
    redirectScreen: '',
    referenceId: n.referenceId || null,
    deletable: false,
  }
  : {
    key: `broadcast:${n._id}`,
    id: n._id,
    source: 'broadcast',
    title: n.title,
    subtitle: n.subtitle || '',
    message: n.message,
    category: n.category,
    priority: n.priority,
    pinned: !!n.pinned,
    read: !!n.read,
    at: n.sentAt || n.receivedAt,
    senderName: n.senderName || 'VS Arogya',
    buttonText: n.buttonText || '',
    redirectScreen: n.redirectScreen || '',
    referenceId: null,
    deletable: true,
  });

/**
 * Both inboxes as one list, newest first. Either side failing resolves to an
 * empty list for that side — one system being unavailable must not blank the
 * whole notification centre.
 */
export async function listNotificationCentre() {
  const [broadcasts, direct] = await Promise.all([
    listInbox().catch(() => []),
    listUserNotifications().catch(() => []),
  ]);
  return [...broadcasts, ...direct]
    .map(unify)
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

/** Marks one row read, routed to whichever system it came from. */
export async function markCentreItemRead(item) {
  if (item.source === 'direct') await markUserNotificationRead(item.id);
  else await post(ENDPOINTS.notifications.markRead(item.id));
  return listNotificationCentre();
}

export async function markCentreAllRead() {
  await Promise.all([
    post(ENDPOINTS.notifications.markAllRead).catch(() => null),
    post(ENDPOINTS.notifications.userMarkAllRead).catch(() => null),
  ]);
  return listNotificationCentre();
}

/** Only a broadcast receipt can be removed; a direct message has no delete route. */
export async function removeCentreItem(item) {
  if (item.deletable) await del(ENDPOINTS.notifications.removeInboxItem(item.id));
  return listNotificationCentre();
}

/** Unread across both systems — what the bell badge shows. */
export async function getCentreUnreadCount() {
  const [broadcast, direct] = await Promise.all([
    getUnreadCount().catch(() => 0),
    getUserUnreadCount().catch(() => 0),
  ]);
  return broadcast + direct;
}
