import KeyValue from '../components/common/KeyValue';
import Note from '../components/common/Note';
import Button from '../components/common/Button';
import { currency } from '../utils/format';
import { formatDate } from '../utils/dates';

/**
 * The invoice record for an accepted order (server/model/invoiceModel.js).
 *
 * The official document is a server-rendered PDF (HTML template → Puppeteer →
 * Cloudinary) whose link is `pdfUrl`. The tax breakdown lives on the PDF; the
 * record only stores totals when the generator filled them in, so those rows
 * appear only when present and the grand total falls back to the order total.
 */
export default function InvoiceSummary({ invoice, order }) {
  if (!invoice) {
    return (
      <Note tone="info">
        An invoice is generated the moment the order is accepted. This one has not been accepted yet.
      </Note>
    );
  }

  const has = (v) => v !== undefined && v !== null && Number(v) > 0;
  const grandTotal = has(invoice.grandTotal) ? invoice.grandTotal : order?.totalAmount;

  return (
    <>
      <KeyValue
        rows={[
          { label: 'Invoice number', value: <span className="mono">{invoice.invoiceNumber}</span> },
          { label: 'Generated', value: formatDate(invoice.generatedAt) },
          has(invoice.subtotal) ? { label: 'Subtotal', value: currency(invoice.subtotal) } : null,
          has(invoice.cgst) ? { label: 'CGST', value: currency(invoice.cgst) } : null,
          has(invoice.sgst) ? { label: 'SGST', value: currency(invoice.sgst) } : null,
          has(invoice.igst) ? { label: 'IGST', value: currency(invoice.igst) } : null,
          has(grandTotal) ? { label: 'Grand total', value: currency(grandTotal), total: true } : null,
        ]}
      />
      {order?.amountWord && (
        <p className="subtle" style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--fs-xs)' }}>
          {order.amountWord}
        </p>
      )}
      {invoice.pdfUrl ? (
        <Button
          variant="secondary" icon="download" block
          href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer"
          style={{ marginTop: 'var(--sp-3)' }}
        >
          Open invoice PDF
        </Button>
      ) : (
        <p className="subtle" style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--fs-xs)' }}>
          The PDF is still being rendered — refresh in a moment.
        </p>
      )}
    </>
  );
}
