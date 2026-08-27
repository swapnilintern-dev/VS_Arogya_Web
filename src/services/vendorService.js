// =============================================================================
// Vendor directory + platform users — routes/adminRoute.js and the address book
// in routes/userRoute.js.
//
// GET /all-vendors returns EVERY account in the Vendor collection (buyers AND
// staff), so consumers filter by `role`, exactly as the Flutter services do.
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, del, USE_MOCK } from './http';
import { delay } from '../mock/seed';
import { ALL_VENDOR_COLLECTION, DEMO_ACCOUNTS } from '../mock/users';
import { normalizeRole, ROLES } from '../constants/roles';
import { APPROVAL_STATUS } from '../constants/orders';

let directory = ALL_VENDOR_COLLECTION.map((u) => ({ ...u }));

export async function listAllAccounts() {
  if (USE_MOCK) { await delay(); return directory.map((u) => ({ ...u })); }
  const body = await get(ENDPOINTS.admin.allVendors, { auth: false });
  return body?.vendors || body?.vendor || body?.users || [];
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

export async function listPendingVendors() {
  if (USE_MOCK) {
    await delay(240);
    return directory.filter(
      (u) => normalizeRole(u.role) === ROLES.VENDOR && u.approvalStatus === APPROVAL_STATUS.PENDING);
  }
  const body = await get(ENDPOINTS.admin.pendingVendors, { auth: false });
  return body?.vendors || body?.vendor || [];
}

export async function countActiveVendors() {
  if (USE_MOCK) {
    await delay(160);
    return directory.filter(
      (u) => normalizeRole(u.role) === ROLES.VENDOR && u.approvalStatus === APPROVAL_STATUS.APPROVED).length;
  }
  const body = await get(ENDPOINTS.admin.activeVendors, { auth: false });
  return Number(body?.count ?? (body?.vendors || []).length ?? 0);
}

export async function getAccount(id) {
  const all = await listAllAccounts();
  return all.find((u) => u._id === id) || null;
}

/** Approving emails the vendor their credentials (server-side nodemailer). */
export async function approveVendor(id) {
  if (USE_MOCK) {
    await delay(650);
    directory = directory.map((u) => (u._id === id ? { ...u, approvalStatus: APPROVAL_STATUS.APPROVED } : u));
    return { success: true, message: 'Vendor approved — credentials emailed.' };
  }
  return put(ENDPOINTS.admin.approveVendor(id), undefined, { auth: false });
}

export async function rejectVendor(id) {
  if (USE_MOCK) {
    await delay(450);
    directory = directory.map((u) => (u._id === id ? { ...u, approvalStatus: APPROVAL_STATUS.REJECTED } : u));
    return { success: true, message: 'Vendor rejected.' };
  }
  return put(ENDPOINTS.admin.rejectVendor(id), undefined, { auth: false });
}

/** POST /agent-create — the SERVER generates and returns a 6-digit password. */
export async function createDeliveryAgent({ name, mobile, email }) {
  if (USE_MOCK) {
    await delay(700);
    const password = String(Math.floor(100000 + Math.random() * 900000));
    const created = {
      _id: `d${Date.now()}`,
      role: ROLES.DELIVERY,
      contact_person_name: name,
      store_name: name,
      mobile_no: mobile,
      email,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      createdAt: new Date().toISOString(),
    };
    directory = [created, ...directory];
    return { agent: created, password };
  }
  const body = await post(ENDPOINTS.delivery.createAgent, { name, mobile, email }, { auth: false });
  return { agent: body?.agent || body, password: body?.password };
}

/** POST /agent-register — marketing registers an Area Agent for one pincode. */
export async function registerAreaAgent({ name, mobileNo, email, pincode, password }) {
  if (USE_MOCK) {
    await delay(650);
    const created = {
      _id: `a${Date.now()}`,
      role: ROLES.AGENT,
      contact_person_name: name,
      store_name: name,
      mobile_no: mobileNo,
      email,
      pin_code: pincode,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      createdAt: new Date().toISOString(),
    };
    directory = [created, ...directory];
    return created;
  }
  return post(ENDPOINTS.agent.register, { name, mobileNo, email, pincode, password });
}

/** GET /agent-profile/:id */
export async function getAgentProfile(agentId) {
  if (USE_MOCK) { await delay(200); return directory.find((u) => u._id === agentId) || DEMO_ACCOUNTS[4]; }
  const body = await get(ENDPOINTS.agent.profile(agentId), { auth: false });
  return body?.agent || body;
}

/** POST /pin-orders/:agentId — every order delivering into the agent's pincode. */
export async function listPincodeOrders(agentId, pincode, allOrders) {
  if (USE_MOCK) {
    await delay(300);
    return (allOrders || []).filter((o) => String(o.shippingAddress?.pincode) === String(pincode));
  }
  const body = await post(ENDPOINTS.agent.pincodeOrders(agentId), {}, { auth: false });
  return body?.orders || [];
}

// --- Address book ------------------------------------------------------------

let addresses = [
  { _id: 'ad1', label: 'Store', fullName: 'Rohit Kulkarni', phone: '9800000003', line1: '12 MG Road, Camp', city: 'Pune', state: 'Maharashtra', pincode: '411001', isDefault: true },
  { _id: 'ad2', label: 'Warehouse', fullName: 'Rohit Kulkarni', phone: '9822114455', line1: 'Unit 7, Market Yard', city: 'Pune', state: 'Maharashtra', pincode: '411037', isDefault: false },
];

export async function listAddresses() {
  if (USE_MOCK) { await delay(180); return addresses.map((a) => ({ ...a })); }
  const body = await get(ENDPOINTS.addresses.list);
  return body?.addresses || [];
}

export async function saveAddress(address) {
  if (USE_MOCK) {
    await delay(320);
    if (address._id) {
      addresses = addresses.map((a) => (a._id === address._id ? { ...a, ...address } : a));
    } else {
      addresses = [...addresses, { ...address, _id: `ad${Date.now()}` }];
    }
    if (address.isDefault) {
      addresses = addresses.map((a) => ({ ...a, isDefault: a._id === (address._id || addresses[addresses.length - 1]._id) }));
    }
    return addresses.map((a) => ({ ...a }));
  }
  const body = address._id
    ? await put(ENDPOINTS.addresses.update(address._id), address)
    : await post(ENDPOINTS.addresses.create, address);
  return body?.addresses || [];
}

export async function deleteAddress(addressId) {
  if (USE_MOCK) {
    await delay(240);
    addresses = addresses.filter((a) => a._id !== addressId);
    return addresses.map((a) => ({ ...a }));
  }
  const body = await del(ENDPOINTS.addresses.remove(addressId));
  return body?.addresses || [];
}
