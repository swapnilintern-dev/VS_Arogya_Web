// =============================================================================
// Disputes + account-deletion requests.
//
// NEITHER has a backend endpoint (analysis §9.4 and §9.5) — both exist as
// Flutter UI with a client-side store and a TODO(backend) marker. They are
// implemented here the same way, and every page that uses them says so.
// =============================================================================

import { delay } from '../mock/seed';
import { DISPUTES, DELETION_REQUESTS } from '../mock/misc';

export const HAS_BACKEND = false;

let disputes = DISPUTES.map((d) => ({ ...d }));
let deletionRequests = DELETION_REQUESTS.map((r) => ({ ...r }));

export async function listDisputes() {
  await delay(220);
  return disputes.map((d) => ({ ...d }));
}

export async function getDispute(id) {
  await delay(160);
  return disputes.find((d) => d._id === id) || null;
}

export async function resolveDispute(id, resolution) {
  await delay(500);
  disputes = disputes.map((d) => (d._id === id ? { ...d, status: resolution } : d));
  return disputes.find((d) => d._id === id);
}

export async function listDeletionRequests() {
  await delay(200);
  return deletionRequests.map((r) => ({ ...r }));
}

export async function actionDeletionRequest(id, action) {
  await delay(450);
  deletionRequests = deletionRequests.map((r) => (r._id === id ? { ...r, status: action } : r));
  return deletionRequests.find((r) => r._id === id);
}
