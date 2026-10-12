// =============================================================================
// Excel reports — routes/xlshRoute.js.
//
// The server exports the FULL table and takes no date/format parameters, so
// there is deliberately no date-range or CSV option here — the same reasoning
// the Flutter Reports screen documents. Stock Report has no endpoint (§9.7).
// =============================================================================

import ENDPOINTS from '../config/api';
import { NotImplementedError, requestBlob } from './http';

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

/** Downloads the .xlsx the server renders. */
export async function downloadReport(reportId) {
  const report = REPORTS.find((r) => r.id === reportId);
  if (!report) throw new Error(`Unknown report: ${reportId}`);
  if (!report.available) throw new NotImplementedError(report.name);

  const blob = await requestBlob(report.endpoint, { timeoutMs: 90000 });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.id}-report.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { url: report.endpoint };
}
