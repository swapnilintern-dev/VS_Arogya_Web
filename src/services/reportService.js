// =============================================================================
// Excel reports — routes/xlshRoute.js.
//
// The server exports the FULL table and takes no date/format parameters, so
// there is deliberately no date-range or CSV option here — the same reasoning
// the Flutter Reports screen documents. Stock Report has no endpoint (§9.7).
// =============================================================================

import ENDPOINTS, { apiUrl } from '../config/api';
import { NotImplementedError, USE_MOCK, getAuthToken } from './http';
import { delay } from '../mock/seed';

export const REPORTS = [
  {
    id: 'orders',
    name: 'Order Report',
    description: 'Every order with its vendor, amount, status and date.',
    endpoint: ENDPOINTS.reports.orders,
    available: true,
  },
  {
    id: 'vendors',
    name: 'Vendor Report',
    description: 'Every registered vendor with contact, licence and approval status.',
    endpoint: ENDPOINTS.reports.vendors,
    available: true,
  },
  {
    id: 'stock',
    name: 'Stock Report',
    description: 'Catalogue stock with batch and expiry breakdown.',
    endpoint: null,
    available: false,
    unavailableReason: 'No backend endpoint yet — the server exposes order and vendor reports only.',
  },
];

/** Triggers the .xlsx download. Mock mode reports the endpoint it would call. */
export async function downloadReport(reportId) {
  const report = REPORTS.find((r) => r.id === reportId);
  if (!report) throw new Error(`Unknown report: ${reportId}`);
  if (!report.available) throw new NotImplementedError(report.name);

  if (USE_MOCK) {
    await delay(900);
    return { simulated: true, url: apiUrl(report.endpoint) };
  }

  const token = getAuthToken();
  const response = await fetch(apiUrl(report.endpoint), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Report download failed (${response.status})`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.id}-report.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { simulated: false };
}
