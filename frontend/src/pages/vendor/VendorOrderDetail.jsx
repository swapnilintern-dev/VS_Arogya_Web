import { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import Spinner from '../../components/feedback/Spinner';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import OrderTimeline from '../../features/OrderTimeline';
import OrderLinesTable from '../../features/OrderLinesTable';
import InvoiceSummary from '../../features/InvoiceSummary';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getOrder, cancelOrder, getInvoice, createPayment, verifyPayment } from '../../services/orderService';
import { openRazorpayCheckout } from '../../utils/razorpay';
import { ORDER_STATUS } from '../../constants/orders';
import { formatDateTime } from '../../utils/dates';

/**
 * The buyer's order page: live status, the lines with their batches, the
 * invoice, and Reorder / Cancel.
 *
 * A vendor can cancel until the order ships; after that it is with a delivery
 * partner and cancellation is a support matter, which is why the button
 * disappears rather than failing.
 */
export default function VendorOrderDetail() {
  const { id } = useParams();
  const cart = useCart();
  const { session } = useAuth();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [busy, setBusy] = useState(false);

  const { data: order, loading, error, reload, setData } = useAsync(() => getOrder(id), [id]);
  const invoice = useAsync(() => getInvoice(id), [id]);

  if (loading) return <DetailSkeleton back={'/shop/orders'} crumbs={[{ label: 'My orders', to: '/shop/orders' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!order) return <ErrorState error={{ message: 'This order no longer exists.' }} />;

  const cancellable = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED].includes(order.orderStatus);
  // Unpaid and not cancelled → the vendor can (re)start the Razorpay payment.
  const payable = order.paymentInfo?.status !== 'Completed'
    && order.paymentMethod !== 'COD'
    && ![ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED].includes(order.orderStatus);

  const payNow = async () => {
    setBusy(true);
    try {
      // The server mints the Razorpay order and verifies the signature.
      const p = await createPayment(order._id, 'ONLINE');
      const result = await openRazorpayCheckout({
        key: p.razorpayKeyId,
        amount: p.amount,
        currency: p.currency,
        orderId: p.razorpayOrderId,
        name: 'VS Arogya',
        description: order.orderNo,
        prefill: { name: session?.name || '', contact: session?.mobile || '' },
      });
      await verifyPayment(result);
      toast.success('Payment confirmed.');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel this order?',
      message: 'The order is cancelled and the stock returns to our shelves. If you have already paid, the refund follows your payment method.',
      confirmLabel: 'Cancel order',
    });
    if (!ok) return;
    setBusy(true);
    try {
      setData(await cancelOrder(order._id));
      toast.success('Order cancelled.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reorder = async () => {
    setBusy(true);
    try {
      for (const line of order.orderItems) {
        if (line.product) {
          // eslint-disable-next-line no-await-in-loop
          await cart.add(line.product, line.quantity);
        }
      }
      toast.success('Items added to your cart.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {confirmUi}
      <PageHeader
        back="/shop/orders"
        crumbs={[{ label: 'My orders', to: '/shop/orders' }, { label: order.orderNo }]}
        title={order.orderNo}
        sub={`Placed ${formatDateTime(order.createdAt)}`}
        actions={(
          <>
            <Button icon="refresh" loading={busy} onClick={reorder}>Reorder</Button>
            {payable && <Button variant="primary" icon="rupee" loading={busy} onClick={payNow}>Pay online</Button>}
            {cancellable && <Button variant="danger-soft" icon="x" loading={busy} onClick={cancel}>Cancel order</Button>}
          </>
        )}
      />

      <div className="row gap-2 wrap section">
        <OrderStatusBadge status={order.orderStatus} />
        <Badge tone={order.paymentInfo?.status === 'Completed' ? 'success' : 'muted'} dot>
          {order.paymentMethod} · {order.paymentInfo?.status || 'Pending'}
        </Badge>
      </div>

      {order.orderStatus === ORDER_STATUS.PENDING && (
        <Note tone="info" className="section">
          Your order is with our team. Once accepted, your tax invoice is generated and the stock is
          allocated from the nearest-expiry batches.
        </Note>
      )}

      <div className="split split--wide-rail">
        <div className="stack gap-4">
          <Card>
            <CardHead title="Items" sub="Batch and expiry are recorded on every line" />
            <OrderLinesTable items={order.orderItems} />
          </Card>

          <Card>
            <CardHead title="Tracking" />
            <CardBody><OrderTimeline order={order} /></CardBody>
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Delivery address" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Address', value: order.shippingAddress.address },
                { label: 'City', value: `${order.shippingAddress.city}, ${order.shippingAddress.state}` },
                { label: 'Pin code', value: <span className="mono">{order.shippingAddress.pincode}</span> },
                { label: 'Phone', value: <span className="mono">{order.shippingAddress.phoneNo}</span> },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHead
              title="Tax invoice"
              actions={invoice.data && (
                <Button size="sm" variant="secondary" icon="download" to={`/shop/orders/${order._id}/invoice`}>
                  View
                </Button>
              )}
            />
            <CardBody>
              {invoice.loading ? <Spinner /> : <InvoiceSummary invoice={invoice.data} order={order} />}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
