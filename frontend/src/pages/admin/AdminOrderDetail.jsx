import { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Spinner from '../../components/feedback/Spinner';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import OrderTimeline from '../../features/OrderTimeline';
import OrderLinesTable from '../../features/OrderLinesTable';
import InvoiceSummary from '../../features/InvoiceSummary';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { getOrder, advanceOrder, cancelOrder, getInvoice } from '../../services/orderService';
import { NEXT_ACTION, ORDER_STATUS } from '../../constants/orders';
import { currency } from '../../utils/format';
import { formatDateTime } from '../../utils/dates';

/** One order, end to end — the desktop version of the app's order sheet. */
export default function AdminOrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [busy, setBusy] = useState(false);

  const { data: order, loading, error, reload, setData } = useAsync(() => getOrder(id), [id]);
  const invoice = useAsync(() => getInvoice(id), [id]);

  if (loading) return <DetailSkeleton back={'/admin/orders'} crumbs={[{ label: 'Orders', to: '/admin/orders' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!order) return <ErrorState error={{ message: 'This order no longer exists.' }} />;

  const action = NEXT_ACTION[order.orderStatus];
  const cancellable = ![ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.orderStatus);

  const advance = async () => {
    setBusy(true);
    try {
      const updated = await advanceOrder(order._id, action.transition);
      setData(updated);
      if (action.transition === 'confirm') invoice.reload();
      toast.success(`Order moved to ${updated.orderStatus}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel this order?',
      message: 'The order is marked cancelled and the stock it reserved is restored to its batches. This cannot be undone.',
      confirmLabel: 'Cancel order',
    });
    if (!ok) return;
    setBusy(true);
    try {
      setData(await cancelOrder(order._id));
      toast.success('Order cancelled — stock restored.');
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
        back="/admin/orders"
        crumbs={[{ label: 'Orders', to: '/admin/orders' }, { label: order.orderNo }]}
        title={order.orderNo}
        sub={`Placed ${formatDateTime(order.createdAt)} by ${order.user.store_name}`}
        actions={(
          <>
            {cancellable && <Button variant="danger-soft" icon="x" loading={busy} onClick={cancel}>Cancel order</Button>}
            {action && <Button variant="primary" icon="check" loading={busy} onClick={advance}>{action.label}</Button>}
          </>
        )}
      />

      <div className="row gap-2 wrap section">
        <OrderStatusBadge status={order.orderStatus} />
        <Badge tone={order.paymentInfo?.status === 'Completed' ? 'success' : 'muted'} dot>
          {order.paymentMethod} · {order.paymentInfo?.status || 'Pending'}
        </Badge>
        {order.source === 'MANUAL_BY_MARKETING' && <Badge tone="accent">Placed by marketing</Badge>}
        {order.outlet && <Badge tone="info">Placed by an outlet</Badge>}
      </div>

      <div className="split split--wide-rail">
        <div className="stack gap-4">
          <Card>
            <CardHead title="Items" sub="With the FEFO batch breakdown recorded at order creation" />
            <OrderLinesTable items={order.orderItems} />
          </Card>

          <Card>
            <CardHead title="Status timeline" />
            <CardBody><OrderTimeline order={order} /></CardBody>
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Buyer" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Store', value: order.user.store_name },
                { label: 'Contact', value: order.user.contact_person_name },
                { label: 'Mobile', value: <span className="mono">{order.user.mobile_no}</span> },
                { label: 'Email', value: order.user.email },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Delivery address" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Address', value: order.shippingAddress.address },
                { label: 'City', value: order.shippingAddress.city },
                { label: 'State', value: order.shippingAddress.state },
                { label: 'Pin code', value: <span className="mono">{order.shippingAddress.pincode}</span> },
                { label: 'Phone', value: <span className="mono">{order.shippingAddress.phoneNo}</span> },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Invoice" />
            <CardBody>
              {invoice.loading
                ? <Spinner />
                : <InvoiceSummary invoice={invoice.data} order={order} />}
              {invoice.data && (
                <p className="subtle" style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--fs-xs)' }}>
                  Order total {currency(order.totalAmount)} · the official PDF is rendered server-side.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
