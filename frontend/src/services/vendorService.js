// =============================================================================
// Vendor directory + platform users — routes/adminRoute.js, agentRoute.js,
// deliveryRoute.js and the address book in routes/userRoute.js.
//
// GET /all-vendors returns EVERY account in the Vendor collection (buyers AND
// staff), so consumers filter by `role`, exactly as the Flutter services do.
//
// Server contracts:
//   GET  /all-vendors            → { all_vendors }
//   GET  /pending-vendor         → { pendingUser }
//   GET  /active-vendors         → { count, active_vendor }
//   PUT  /approval-mail/:id      → { success }   (emails credentials)
//   PUT  /reject-vendor/:id      → { success }
//   POST /agent-create           → { agentDetails }  body { fullName, email, mobile }; server sets password
//   POST /agent-register (auth)  → { agent }         body { name, mobileNo, email, pincode, password }
//   GET  /agent-profile/:id      → { agent }
//   POST /pin-orders/:agentId    → { orders }        (user + product populated)
//   GET/POST/PUT/DELETE /addresses → { addresses }
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, del } from './http';
import { normalizeRole, ROLES } from '../constants/roles';
import { APPROVAL_STATUS } from '../constants/orders';
import { normalizeOrder } from './orderService';

export async function listAllAccounts() {
  const body = await get(ENDPOINTS.admin.allVendors);
  return body?.all_vendors || [];
}

/** Buyers only — staff roles filtered out. */
export async function listVendors() {
  const all = await listAllAccounts();
  return all.filter((u) => normalizeRole(u.role) === ROLES.VENDOR);
}

/** Approved buyers — the manual-order and POS flows only accept these. */
export async function listApprovedVendors() {
  const vendors = await listVendors();
  return vendors.filter((v) => v.approvalStatus === APPROVAL_STATUS.APPROVED);
}

export async function listDeliveryAgents() {
  const all = await listAllAccounts();
  return all.filter((u) => normalizeRole(u.role) === ROLES.DELIVERY);
}

export async function listAreaAgents() {
  const all = await listAllAccounts();
  return all.filter((u) => normalizeRole(u.role) === ROLES.AGENT);
}

/** Buyers awaiting approval (the server lists every Pending account; staff are filtered). */
export async function listPendingVendors() {
  const body = await get(ENDPOINTS.admin.pendingVendors);
  return (body?.pendingUser || []).filter((u) => normalizeRole(u.role) === ROLES.VENDOR);
}

export async function countActiveVendors() {
  const body = await get(ENDPOINTS.admin.activeVendors);
  const rows = (body?.active_vendor || []).filter((u) => normalizeRole(u.role) === ROLES.VENDOR);
  return rows.length;
}

export async function getAccount(id) {
  const all = await listAllAccounts();
  return all.find((u) => u._id === id) || null;
}

/** Approving emails the vendor their credentials (server-side nodemailer). */
export async function approveVendor(id) {
  return put(ENDPOINTS.admin.approveVendor(id), undefined, { timeoutMs: 60000 });
}

export async function rejectVendor(id) {
  return put(ENDPOINTS.admin.rejectVendor(id), undefined, { timeoutMs: 60000 });
}

/** POST /agent-create — the SERVER generates the 6-digit password and returns the account. */
export async function createDeliveryAgent({ name, mobile, email }) {
  const body = await post(ENDPOINTS.delivery.createAgent, { fullName: name, mobile, email });
  const agent = body?.agentDetails || body?.agent || {};
  return { agent, password: agent.password };
}

/** POST /agent-register — marketing registers an Area Agent for one pincode. */
export async function registerAreaAgent({ name, mobileNo, email, pincode, password }) {
  const body = await post(ENDPOINTS.agent.register, { name, mobileNo, email, pincode, password });
  return body?.agent || body;
}

/** GET /agent-profile/:id */
export async function getAgentProfile(agentId) {
  const body = await get(ENDPOINTS.agent.profile(agentId));
  return body?.agent || null;
}

/** POST /pin-orders/:agentId — every live order delivering into the agent's pincode. */
export async function listPincodeOrders(agentId) {
  const body = await post(ENDPOINTS.agent.pincodeOrders(agentId), {});
  return (body?.orders || []).map(normalizeOrder);
}

// --- Address book ------------------------------------------------------------

export async function listAddresses() {
  const body = await get(ENDPOINTS.addresses.list);
  return body?.addresses || [];
}

export async function saveAddress(address) {
  const body = address._id
    ? await put(ENDPOINTS.addresses.update(address._id), address)
    : await post(ENDPOINTS.addresses.create, address);
  return body?.addresses || [];
}

export async function deleteAddress(addressId) {
  const body = await del(ENDPOINTS.addresses.remove(addressId));
  return body?.addresses || [];
}
