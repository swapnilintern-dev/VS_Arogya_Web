import KeyValue from '../components/common/KeyValue';
import Note from '../components/common/Note';
import { currency } from '../utils/format';
import { formatDate } from '../utils/dates';

/**
 * The invoice record for an accepted order (server/model/invoiceModel.js).
 *
 * The official document is a server-rendered PDF (HTML template → Puppeteer →
 * Cloudinary), fetched by GET /prev-invoice/:id. While the site runs on mock
 * data there is no document to fetch, so the summary below is shown instead —
 * the same "server-first, on-device fallback" shape the app uses.
 */
export default function InvoiceSummary({ invoice, order }) {
  if (!invoice) {
    return (
      <Note tone="info">
        An invoice is generated the moment the order is accepted. This one has not been accepted yet.
      </Note>
    );
  }

  return (
    <>
      <KeyValue
        rows={[
          { label: 'Invoice number', value: <span className="mono">{invoice.invoiceNumber}</span> },
          { label: 'Generated', value: formatDate(invoice.generatedAt) },
          { label: 'Subtotal', value: currency(invoice.subtotal) },
          invoice.cgst ? { label: 'CGST', value: currency(invoice.cgst) } : null,
          invoice.sgst ? { label: 'SGST', value: currency(invoice.sgst) } : null,
          invoice.igst ? { label: 'IGST', value: currency(invoice.igst) } : null,
          { label: 'Grand total', value: currency(invoice.grandTotal), total: true },
        ]}
      />
      {order?.amountWord && (
        <p className="subtle" style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--fs-xs)' }}>
          {order.amountWord}
        </p>
      )}
    </>
  );
}
