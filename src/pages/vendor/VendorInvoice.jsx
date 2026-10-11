import { useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import KeyValue from '../../components/common/KeyValue';
import Spinner from '../../components/feedback/Spinner';
import ErrorState from '../../components/feedback/ErrorState';
import OrderLinesTable from '../../features/OrderLinesTable';
import InvoiceSummary from '../../features/InvoiceSummary';
import useAsync from '../../hooks/useAsync';
import { getOrder, getInvoice } from '../../services/orderService';
import { formatDate } from '../../utils/dates';

/**
 * Invoice viewer.
 *
 * The OFFICIAL document is a server-rendered PDF: GET /prev-invoice/:id answers
 * a 302 to the hosted file. Nothing is rendered on-device here — when the PDF
 * is unavailable this page shows the invoice record and says why, which is the
 * same "server-first, fallback second" behaviour the app has.
 */
export default function VendorInvoice() {
  const { id } = useParams();
  const order = useAsync(() => getOrder(id), [id]);
  const invoice = useAsync(() => getInvoice(id), [id]);

  if (order.loading || invoice.loading) return <div className="state"><Spinner size="lg" /></div>;
  if (order.error) return <ErrorState error={order.error} onRetry={order.reload} />;
  if (!order.data) return <ErrorState error={{ message: 'This order no longer exists.' }} />;

  const inv = invoice.data;

  return (
    <>
      <PageHeader
        back={`/shop/orders/${id}`}
        crumbs={[
          { label: 'My orders', to: '/shop/orders' },
          { label: order.data.orderNo, to: `/shop/orders/${id}` },
          { label: 'Invoice' },
        ]}
        title={inv ? `Invoice ${inv.invoiceNumber}` : 'Invoice'}
        sub={inv ? `Generated ${formatDate(inv.generatedAt)}` : 'Not generated yet'}
        actions={inv?.pdfUrl && <Button variant="primary" icon="download" href={inv.pdfUrl}>Download PDF</Button>}
      />

      {!inv && (
        <Note tone="info" className="section">
          An invoice is generated the moment your order is accepted. This one has not been accepted yet.
        </Note>
      )}

      {inv && !inv.pdfUrl && (
        <Note tone="warning" className="section">
          The server has not finished rendering the PDF yet. The invoice details below are final; try the download again shortly.
        </Note>
      )}

      {inv && (
        <div className="split">
          <Card>
            <CardHead title="Invoice lines" sub="Exactly as they appear on the tax invoice" />
            <OrderLinesTable items={order.data.orderItems} />
          </Card>

          <div className="rail">
            <Card>
              <CardHead title="Summary" />
              <CardBody><InvoiceSummary invoice={inv} order={order.data} /></CardBody>
            </Card>

            <Card>
              <CardHead title="Billed to" />
              <CardBody>
                <KeyValue rows={[
                  { label: 'Store', value: order.data.user.store_name },
                  { label: 'Address', value: order.data.shippingAddress.address },
                  { label: 'City', value: `${order.data.shippingAddress.city}, ${order.data.shippingAddress.state}` },
                  { label: 'Pin code', value: <span className="mono">{order.data.shippingAddress.pincode}</span> },
                  { label: 'Order', value: <span className="mono">{order.data.orderNo}</span> },
                ]} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
