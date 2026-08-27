import { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Modal from '../../components/common/Modal';
import Note from '../../components/common/Note';
import Spinner from '../../components/feedback/Spinner';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import EmptyState from '../../components/feedback/EmptyState';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import OrderTimeline from '../../features/OrderTimeline';
import OrderLinesTable from '../../features/OrderLinesTable';
import InvoiceSummary from '../../features/InvoiceSummary';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { getOrder, advanceOrder, cancelOrder, getInvoice } from '../../services/orderService';
import { listDeliveryAgents } from '../../services/vendorService';
import { NEXT_ACTION, ORDER_STATUS } from '../../constants/orders';
import { formatDateTime } from '../../utils/dates';
import { initials } from '../../utils/format';

/**
 * One order for the marketing role, with the contextual pipeline action.
 *
 * Moving a Shipped order to Out for Delivery opens the agent picker — the same
 * step the app takes (assign_agent_sheet.dart). The chosen agent is recorded
 * for the team's own reference: the ORDER MODEL has no per-agent field, so the
 * assignment cannot be persisted until the backend gains one.
 */
export default function MarketingOrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const { data: order, loading, error, reload, setData } = useAsync(() => getOrder(id), [id]);
  const invoice = useAsync(() => getInvoice(id), [id]);
  const agents = useAsync(listDeliveryAgents, [], { immediate: false });

  if (loading) return <DetailSkeleton back={'/marketing/orders'} crumbs={[{ label: 'Orders', to: '/marketing/orders' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!order) return <ErrorState error={{ message: 'This order no longer exists.' }} />;

  const action = NEXT_ACTION[order.orderStatus];
  const cancellable = ![ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.orderStatus);

  const doAdvance = async (agentName) => {
    setBusy(true);
    try {
      const updated = await advanceOrder(order._id, action.transition);
      setData(updated);
      if (action.transition === 'confirm') invoice.reload();
      toast.success(
        action.transition === 'confirm'
          ? 'Order accepted — invoice generated and stock deducted.'
          : agentName
            ? `Out for delivery with ${agentName}.`
            : `Order moved to ${updated.orderStatus}.`,
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setPicking(false);
    }
  };

  const onPrimary = () => {
    if (action.transition === 'outForDelivery') {
      agents.reload();
      setPicking(true);
      return;
    }
    doAdvance();
  };

  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel this order?',
      message: 'The order is cancelled and every allocated batch has its units returned. This cannot be undone.',
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
        back="/marketing/orders"
        crumbs={[{ label: 'Orders', to: '/marketing/orders' }, { label: order.orderNo }]}
        title={order.orderNo}
        sub={`${order.user.store_name} · placed ${formatDateTime(order.createdAt)}`}
        actions={(
          <>
            {cancellable && <Button variant="danger-soft" icon="x" loading={busy} onClick={cancel}>Cancel</Button>}
            {action && <Button variant="primary" icon="check" loading={busy} onClick={onPrimary}>{action.label}</Button>}
          </>
        )}
      />

      <div className="row gap-2 wrap section">
        <OrderStatusBadge status={order.orderStatus} />
        <Badge tone={order.paymentInfo?.status === 'Completed' ? 'success' : 'muted'} dot>
          {order.paymentMethod} · {order.paymentInfo?.status || 'Pending'}
        </Badge>
        {order.source === 'MANUAL_BY_MARKETING' && <Badge tone="accent">Placed by marketing</Badge>}
        {order.clientOrderId && (
          <Badge tone="outline">Idempotency key {order.clientOrderId.slice(0, 12)}…</Badge>
        )}
      </div>

      {order.orderStatus === ORDER_STATUS.PENDING && (
        <Note tone="info" className="section">
          Accepting this order is what commits it: the server generates the tax invoice and deducts each
          line from its FEFO front lot. Cancelling later restores those units.
        </Note>
      )}

      <div className="split split--wide-rail">
        <div className="stack gap-4">
          <Card>
            <CardHead title="Items" sub="Each line shows the exact lots it consumes" />
            <OrderLinesTable items={order.orderItems} />
          </Card>
          <Card>
            <CardHead title="Status timeline" />
            <CardBody><OrderTimeline order={order} /></CardBody>
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Buyer & delivery" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Store', value: order.user.store_name },
                { label: 'Contact', value: order.user.contact_person_name },
                { label: 'Mobile', value: <span className="mono">{order.shippingAddress.phoneNo}</span> },
                { label: 'Address', value: order.shippingAddress.address },
                { label: 'City', value: `${order.shippingAddress.city}, ${order.shippingAddress.state}` },
                { label: 'Pin code', value: <span className="mono">{order.shippingAddress.pincode}</span> },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Invoice" />
            <CardBody><InvoiceSummary invoice={invoice.data} order={order} /></CardBody>
          </Card>
        </div>
      </div>

      {picking && (
        <Modal
          title="Assign a delivery partner"
          sub="Pick who takes this order out"
          onClose={() => setPicking(false)}
        >
          {agents.loading && <div className="state"><Spinner /></div>}
          {!agents.loading && !agents.data?.length && (
            <EmptyState
              icon="truck"
              title="No delivery partners registered"
              text="An admin creates delivery agent logins from the Delivery agents console."
            />
          )}
          {agents.data?.length > 0 && (
            <>
              <Note tone="warning" style={{ marginBottom: 'var(--sp-4)' }}>
                The order record has no per-agent field, so this choice is for your team’s reference — the
                order becomes visible to every signed-in agent in the shared dispatch queue.
              </Note>
              <div className="stack gap-2">
                {agents.data.map((a) => (
                  <button
                    key={a._id}
                    type="button"
                    className="row gap-3"
                    disabled={busy}
                    onClick={() => doAdvance(a.contact_person_name)}
                    style={{
                      padding: 'var(--sp-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      textAlign: 'left',
                    }}
                  >
                    <span className="avatar avatar--sm">{initials(a.contact_person_name)}</span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{a.contact_person_name}</span>
                      <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                        {a.mobile_no} · {a.city}
                      </span>
                    </span>
                    <Badge tone="success" dot>Available</Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
