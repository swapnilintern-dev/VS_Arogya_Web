import { useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import OrderTimeline from '../../features/OrderTimeline';
import OrderLinesTable from '../../features/OrderLinesTable';
import useAsync from '../../hooks/useAsync';
import { getOrder } from '../../services/orderService';
import { formatDateTime } from '../../utils/dates';
import { currency } from '../../utils/format';

/** Read-only order view. No actions — the agent only monitors. */
export default function AgentOrderDetail() {
  const { id } = useParams();
  const { data: order, loading, error, reload } = useAsync(() => getOrder(id), [id]);

  if (loading) return <DetailSkeleton back={'/agent'} crumbs={[{ label: 'Pincode orders', to: '/agent' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!order) return <ErrorState error={{ message: 'This order no longer exists.' }} />;

  return (
    <>
      <PageHeader
        back="/agent"
        crumbs={[{ label: 'Pincode orders', to: '/agent' }, { label: order.orderNo }]}
        title={order.orderNo}
        sub={`${order.user.store_name} · placed ${formatDateTime(order.createdAt)}`}
      />

      <div className="row gap-2 wrap section">
        <OrderStatusBadge status={order.orderStatus} />
        <Badge tone={order.paymentInfo?.status === 'Completed' ? 'success' : 'muted'} dot>
          {order.paymentMethod} · {order.paymentInfo?.status || 'Pending'}
        </Badge>
      </div>

      <Note tone="info" className="section">
        Read-only. Contact the marketing team if this order needs to be chased or changed.
      </Note>

      <div className="split">
        <div className="stack gap-4">
          <Card>
            <CardHead title="Items" sub="Which medicine and how much" />
            <OrderLinesTable items={order.orderItems} showBatches={false} />
          </Card>

          <Card>
            <CardHead title="Status timeline" />
            <CardBody><OrderTimeline order={order} /></CardBody>
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Delivery address" sub="The field this order is matched to your pincode on" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Buyer', value: order.user.store_name },
                { label: 'Contact', value: <span className="mono">{order.shippingAddress.phoneNo}</span> },
                { label: 'Address', value: order.shippingAddress.address },
                { label: 'City', value: `${order.shippingAddress.city}, ${order.shippingAddress.state}` },
                { label: 'Pincode', value: <span className="mono" style={{ fontWeight: 700 }}>{order.shippingAddress.pincode}</span> },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Order value" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Lines', value: order.orderItems.length },
                { label: 'Units', value: order.orderItems.reduce((s, it) => s + it.quantity, 0) },
                { label: 'Total', value: currency(order.totalAmount), total: true },
              ]} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
