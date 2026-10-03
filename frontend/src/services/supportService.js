// =============================================================================
// Disputes + account-deletion requests.
//
// NEITHER has a backend endpoint (analysis §9.4 and §9.5) — both exist in the
// Flutter app as UI with a TODO(backend) marker. Until the server grows the
// routes these resolve to empty lists, and the pages say so plainly rather
// than showing invented rows.
// =============================================================================

import { NotImplementedError } from './http';

export const HAS_BACKEND = false;

export async function listDisputes() {
  return [];
}

export async function getDispute() {
  return null;
}

export async function resolveDispute() {
  throw new NotImplementedError('Dispute resolution');
}

export async function listDeletionRequests() {
  return [];
}

export async function actionDeletionRequest() {
  throw new NotImplementedError('Account deletion requests');
}
