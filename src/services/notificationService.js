// =============================================================================
// Notifications — routes/notificationRoute.js.
//
// The backend is fully implemented (FCM broadcast + scheduler + per-device
// tokens); lib/notifications/ ships the API + models + controllers but no
// Flutter screens yet. The website implements both sides against that contract.
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, del, request, USE_MOCK } from './http';
import { delay } from '../mock/seed';
import { CAMPAIGNS, NOTIFICATION_INBOX, AUDIENCE_SUMMARY } from '../mock/marketing';

let campaigns = CAMPAIGNS.map((c) => ({ ...c }));
let inbox = NOTIFICATION_INBOX.map((n) => ({ ...n }));

// --- Marketing broadcast panel ----------------------------------------------

export async function listCampaigns() {
  if (USE_MOCK) { await delay(260); return campaigns.map((c) => ({ ...c })); }
  const body = await get(ENDPOINTS.notifications.list);
  return body?.notifications || body?.items || [];
}

export async function getCampaign(id) {
  if (USE_MOCK) { await delay(160); return campaigns.find((c) => c._id === id) || null; }
  const body = await get(ENDPOINTS.notifications.detail(id));
  return body?.notification || body;
}

export async function getAudienceSummary() {
  if (USE_MOCK) { await delay(180); return { ...AUDIENCE_SUMMARY }; }
  const body = await get(ENDPOINTS.notifications.audience);
  return body?.audience || body;
}

export async function createCampaign(fields, bannerFile) {
  if (USE_MOCK) {
    await delay(600);
    const created = {
      _id: `n${Date.now()}`,
      ...fields,
      status: fields.sendNow ? 'sent' : fields.scheduledAt ? 'scheduled' : 'draft',
      sentAt: fields.sendNow ? new Date().toISOString() : null,
      bannerImage: { url: bannerFile ? URL.createObjectURL(bannerFile) : '', publicId: '' },
      sender: { name: 'Meera Kulkarni', role: 'marketing' },
      stats: { targeted: 0, tokens: 0, sent: 0, delivered: 0, failed: 0, opened: 0, read: 0, retryCount: 0 },
      lastError: '',
      createdAt: new Date().toISOString(),
    };
    campaigns = [created, ...campaigns];
    return created;
  }
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== '') form.append(k, v); });
  if (bannerFile) form.append('bannerImage', bannerFile);
  return request(ENDPOINTS.notifications.create, { method: 'POST', body: form });
}

export async function updateCampaign(id, fields) {
  if (USE_MOCK) {
    await delay(420);
    campaigns = campaigns.map((c) => (c._id === id ? { ...c, ...fields } : c));
    return campaigns.find((c) => c._id === id);
  }
  return put(ENDPOINTS.notifications.update(id), fields);
}

export async function sendCampaign(id) {
  if (USE_MOCK) {
    await delay(900);
    campaigns = campaigns.map((c) => {
      if (c._id !== id) return c;
      const targeted = AUDIENCE_SUMMARY.eligibleVendors;
      const tokens = AUDIENCE_SUMMARY.reachableVendors;
      return {
        ...c,
        status: 'sent',
        sentAt: new Date().toISOString(),
        stats: { ...c.stats, targeted, tokens, sent: tokens, delivered: Math.round(tokens * 0.93), failed: Math.round(tokens * 0.04) },
      };
    });
    return campaigns.find((c) => c._id === id);
  }
  return post(ENDPOINTS.notifications.send(id));
}

export async function retryCampaign(id) {
  if (USE_MOCK) {
    await delay(700);
    campaigns = campaigns.map((c) =>
      c._id === id
        ? { ...c, status: 'sent', lastError: '', stats: { ...c.stats, retryCount: c.stats.retryCount + 1, failed: 0, sent: c.stats.tokens } }
        : c);
    return campaigns.find((c) => c._id === id);
  }
  return post(ENDPOINTS.notifications.retry(id));
}

export async function duplicateCampaign(id) {
  if (USE_MOCK) {
    await delay(400);
    const source = campaigns.find((c) => c._id === id);
    const copy = {
      ...source,
      _id: `n${Date.now()}`,
      title: `${source.title} (copy)`,
      status: 'draft',
      sentAt: null,
      stats: { targeted: 0, tokens: 0, sent: 0, delivered: 0, failed: 0, opened: 0, read: 0, retryCount: 0 },
      createdAt: new Date().toISOString(),
    };
    campaigns = [copy, ...campaigns];
    return copy;
  }
  return post(ENDPOINTS.notifications.duplicate(id));
}

export async function deleteCampaign(id) {
  if (USE_MOCK) { await delay(280); campaigns = campaigns.filter((c) => c._id !== id); return { success: true }; }
  return del(ENDPOINTS.notifications.remove(id));
}

export async function getCampaignStats(id) {
  if (USE_MOCK) { await delay(200); return campaigns.find((c) => c._id === id)?.stats || null; }
  const body = await get(ENDPOINTS.notifications.stats(id));
  return body?.stats || body;
}

// --- Vendor notification centre ---------------------------------------------

export async function listInbox() {
  if (USE_MOCK) { await delay(240); return inbox.map((n) => ({ ...n })); }
  const body = await get(ENDPOINTS.notifications.inbox);
  return body?.notifications || body?.items || [];
}

export async function getUnreadCount() {
  if (USE_MOCK) { await delay(120); return inbox.filter((n) => !n.read).length; }
  const body = await get(ENDPOINTS.notifications.unreadCount);
  return Number(body?.count ?? 0);
}

export async function markRead(id) {
  if (USE_MOCK) {
    await delay(120);
    inbox = inbox.map((n) => (n._id === id ? { ...n, read: true, opened: true } : n));
    return inbox.map((n) => ({ ...n }));
  }
  await post(ENDPOINTS.notifications.markRead(id));
  return listInbox();
}

export async function markAllRead() {
  if (USE_MOCK) { await delay(200); inbox = inbox.map((n) => ({ ...n, read: true })); return inbox.map((n) => ({ ...n })); }
  await post(ENDPOINTS.notifications.markAllRead);
  return listInbox();
}

export async function deleteInboxItem(id) {
  if (USE_MOCK) { await delay(160); inbox = inbox.filter((n) => n._id !== id); return inbox.map((n) => ({ ...n })); }
  await del(ENDPOINTS.notifications.removeInboxItem(id));
  return listInbox();
}
