import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import Spinner from '../../components/feedback/Spinner';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import Icon from '../../components/feedback/Icon';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import OrderLinesTable from '../../features/OrderLinesTable';
import InvoiceSummary from '../../features/InvoiceSummary';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { getOrder, getInvoice } from '../../services/orderService';
import { createOutletPaymentLink, getOutletOrderStatus } from '../../services/outletService';
import { formatDateTime } from '../../utils/dates';
import { currency } from '../../utils/format';

/**
 * One counter order.
 *
 * LOCKED RULE: payment status is SERVER-OWNED. This page can ask the server to
 * mint a Razorpay link and can poll the status, but it never marks an order
 * paid — the state shown is always whatever the server last reported.
 */
export default function OutletOrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const toast = useToast();

  const { data: order, loading, error, reload } = useAsync(() => getOrder(id), [id]);
  const invoice = useAsync(() => getInvoice(id), [id]);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  if (loading) return <DetailSkeleton back={'/outlet/orders'} crumbs={[{ label: 'Orders', to: '/outlet/orders' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!order) return <ErrorState error={{ message: 'This order no longer exists.' }} />;

  const paid = order.paymentInfo?.status === 'Completed' || status?.paid;

  const mintLink = async () => {
    setBusy(true);
    try {
      setLink(await createOutletPaymentLink(order._id));
      toast.success('Payment link created — show the QR or share it.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const poll = async () => {
    setBusy(true);
    try {
      const next = await getOutletOrderStatus(order._id);
      setStatus(next);
      toast[next.paid ? 'success' : 'info'](
        next.paid ? 'Payment confirmed by the server.' : `Still ${next.status.toLowerCase().replace(/_/g, ' ')}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        back="/outlet/orders"
        crumbs={[{ label: 'Orders', to: '/outlet/orders' }, { label: order.orderNo }]}
        title={order.orderNo}
        sub={`${order.user.store_name} · ${formatDateTime(order.createdAt)}`}
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      {location.state?.justBilled && (
        <Note tone="success" className="section">
          Bill placed. Your lots have been deducted and the server is rendering the tax invoice. The
          customer’s vendor registration has been filed with admin in the background.
        </Note>
      )}

      <div className="row gap-2 wrap section">
        <OrderStatusBadge status={order.orderStatus} />
        <Badge tone={paid ? 'success' : 'warning'} dot>
          {paid ? 'Paid' : `Awaiting payment · ${currency(order.totalAmount)}`}
        </Badge>
      </div>

      <div className="split">
        <div className="stack gap-4">
          <Card>
            <CardHead title="Items" sub="With the lots this bill consumed" />
            <OrderLinesTable items={order.orderItems} />
          </Card>

          <Card>
            <CardHead title="Customer" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Name', value: order.user.store_name },
                { label: 'Mobile', value: <span className="mono">{order.user.mobile_no}</span> },
                { label: 'Address', value: order.shippingAddress.address },
                { label: 'City', value: `${order.shippingAddress.city} — ${order.shippingAddress.pincode}` },
              ]} />
            </CardBody>
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Payment" />
            <CardBody className="stack gap-3">
              {paid ? (
                <Note tone="success">Confirmed by the server. Nothing further to collect.</Note>
              ) : (
                <>
                  <KeyValue rows={[{ label: 'Amount due', value: currency(order.totalAmount), total: true }]} />
                  {!link ? (
                    <Button variant="primary" icon="qr" block loading={busy} onClick={mintLink}>
                      Create payment link / QR
                    </Button>
                  ) : (
                    <>
                      <div
                        style={{
                          display: 'grid', placeItems: 'center', padding: 'var(--sp-6)',
                          background: 'var(--surface-sunken)', borderRadius: 'var(--r-md)',
                        }}
                      >
                        <Icon name="qr" size={64} strokeWidth={1.2} />
                        <p className="subtle" style={{ fontSize: 'var(--fs-xs)', marginTop: 8 }}>
                          Customer scans to pay
                        </p>
                      </div>
                      <div className="row gap-2">
                        <input className="input mono" readOnly value={link.link_url} />
                        <Button variant="secondary" icon="copy"
                          onClick={() => { navigator.clipboard?.writeText(link.link_url); toast.success('Link copied.'); }}
                          aria-label="Copy payment link" />
                      </div>
                      <Button variant="primary" icon="refresh" block loading={busy} onClick={poll}>
                        Check payment status
                      </Button>
                    </>
                  )}
                  <Note tone="info">
                    The server is the only authority on payment. Nothing is marked paid from this browser —
                    the status flips only once Razorpay confirms it.
                  </Note>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Invoice" />
            <CardBody>
              {invoice.loading ? <Spinner /> : <InvoiceSummary invoice={invoice.data} order={order} />}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
