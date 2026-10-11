import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import Icon from '../../components/feedback/Icon';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import OrderStatusBadge from '../../features/OrderStatusBadge';
import OrderLinesTable from '../../features/OrderLinesTable';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { getOrder } from '../../services/orderService';
import { completeTask, pickUpTask, createDoorstepPaymentLink, getDoorstepPaymentStatus } from '../../services/deliveryService';
import { ORDER_STATUS, PAYMENT_METHOD } from '../../constants/orders';
import { currency, number } from '../../utils/format';
import cn from '../../utils/cn';

/**
 * Confirm a delivery.
 *
 * The rider verifies the items, settles payment, then marks it delivered. Only
 * the last step is authoritative — the backend has no OTP or proof-of-delivery
 * storage, so the item checklist is a local confirmation for the rider's own
 * benefit, and this page says so rather than implying it is recorded.
 *
 * DOORSTEP PAYMENT: the SERVER mints a Razorpay payment link, the customer pays
 * on their own phone, and the rider polls until Razorpay confirms it. The client
 * never marks anything paid.
 */
export default function DeliveryTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();

  const { data: order, loading, error, reload, setData } = useAsync(() => getOrder(id), [id]);
  const [checked, setChecked] = useState({});
  const [settle, setSettle] = useState(null); // 'online' | 'cash'
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <DetailSkeleton back={'/delivery'} crumbs={[{ label: 'Task queue', to: '/delivery' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!order) return <ErrorState error={{ message: 'This order no longer exists.' }} />;

  const alreadyPaid = order.paymentInfo?.status === 'Completed';
  const needsCollection = order.paymentMethod === PAYMENT_METHOD.COD && !alreadyPaid;
  const allChecked = order.orderItems.every((it) => checked[it.product?._id]);
  const settled = alreadyPaid || settle !== null;
  const canDeliver = order.orderStatus === ORDER_STATUS.OUT_FOR_DELIVERY && allChecked && settled;

  const mintLink = async () => {
    setBusy(true);
    try {
      setLink(await createDoorstepPaymentLink(order._id));
      toast.success('Payment link created — share it with the customer.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const checkPayment = async () => {
    setBusy(true);
    try {
      const status = await getDoorstepPaymentStatus(order._id);
      if (status.paid) {
        setSettle('online');
        toast.success('Payment confirmed by Razorpay.');
      } else {
        toast.info('Not confirmed yet — ask the customer to complete the payment, then check again.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pickUp = async () => {
    setBusy(true);
    try {
      setData(await pickUpTask(order._id));
      toast.success('Picked up — you are out for delivery.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deliver = async () => {
    const ok = await confirm({
      title: 'Mark this order delivered?',
      message: `${order.orderNo} will be recorded as delivered to ${order.user.store_name}. This is the final step and cannot be undone.`,
      confirmLabel: 'Mark delivered',
      tone: 'primary',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await completeTask(order._id);
      toast.success('Delivery completed.');
      navigate('/delivery');
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      {confirmUi}
      <PageHeader
        back="/delivery"
        crumbs={[{ label: 'Task queue', to: '/delivery' }, { label: order.orderNo }]}
        title={order.orderNo}
        sub={`${order.user.store_name} · ${order.shippingAddress.city}`}
        actions={order.orderStatus === ORDER_STATUS.SHIPPED && (
          <Button variant="primary" icon="truck" loading={busy} onClick={pickUp}>Pick up</Button>
        )}
      />

      <div className="row gap-2 wrap section">
        <OrderStatusBadge status={order.orderStatus} />
        <Badge tone={alreadyPaid ? 'success' : 'warning'} dot>
          {alreadyPaid ? 'Paid online' : `${order.paymentMethod} · collect ${currency(order.totalAmount)}`}
        </Badge>
      </div>

      <div className="split">
        <div className="stack gap-4">
          <Card>
            <CardHead
              title="Verify items"
              sub="Tick each line as you hand it over"
              actions={<Badge tone={allChecked ? 'success' : 'muted'}>{Object.values(checked).filter(Boolean).length}/{order.orderItems.length}</Badge>}
            />
            <CardBody className="stack gap-2">
              {order.orderItems.map((it) => (
                <label
                  key={it.product?._id}
                  className="row gap-3"
                  style={{
                    padding: 'var(--sp-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    background: checked[it.product?._id] ? 'var(--brand-050)' : 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!checked[it.product?._id]}
                    onChange={(e) => setChecked((c) => ({ ...c, [it.product?._id]: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--brand-700)' }}
                  />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{it.product?.title}</span>
                    <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                      {it.product?.packInfo}
                      {it.batch_no ? ` · batch ${it.batch_no}` : ''}
                    </span>
                  </span>
                  <strong className="num">
                    {number(it.quantity)}{it.freeQty > 0 ? ` + ${it.freeQty} free` : ''}
                  </strong>
                </label>
              ))}
              <Note tone="info">
                This checklist is for you — the backend stores no proof-of-delivery, so only the delivered
                status below is recorded.
              </Note>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Order lines" />
            <OrderLinesTable items={order.orderItems} showBatches={false} />
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Deliver to" />
            <CardBody className="stack gap-3">
              <KeyValue rows={[
                { label: 'Store', value: order.user.store_name },
                { label: 'Address', value: order.shippingAddress.address },
                { label: 'City', value: `${order.shippingAddress.city} — ${order.shippingAddress.pincode}` },
              ]} />
              <Button variant="secondary" icon="phone" block href={`tel:${order.shippingAddress.phoneNo}`}>
                Call {order.shippingAddress.phoneNo}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Payment" />
            <CardBody className="stack gap-3">
              {alreadyPaid ? (
                <Note tone="success">Already paid online — nothing to collect.</Note>
              ) : (
                <>
                  <KeyValue rows={[{ label: 'Amount due', value: currency(order.totalAmount), total: true }]} />

                  {settle === 'online' && <Note tone="success">Payment confirmed by Razorpay.</Note>}
                  {settle === 'cash' && <Note tone="warning">Recorded as cash collected at the door.</Note>}

                  {settle === null && (
                    <>
                      {!link ? (
                        <Button variant="primary" icon="qr" block loading={busy} onClick={mintLink}>
                          Create payment link
                        </Button>
                      ) : (
                        <div className="stack gap-2">
                          <Note tone="info">
                            Share this link or show the QR. The server confirms the payment — check below once
                            the customer has paid.
                          </Note>
                          <div className="row gap-2">
                            <input className="input mono" readOnly value={link.link_url} />
                            <Button
                              variant="secondary"
                              icon="copy"
                              onClick={() => { navigator.clipboard?.writeText(link.link_url); toast.success('Link copied.'); }}
                              aria-label="Copy link"
                            />
                          </div>
                          <Button variant="primary" icon="refresh" block loading={busy} onClick={checkPayment}>
                            Check payment status
                          </Button>
                        </div>
                      )}
                      <Button
                        variant="secondary"
                        icon="rupee"
                        block
                        onClick={() => { setSettle('cash'); toast.info('Cash collection recorded locally.'); }}
                      >
                        Collected cash instead
                      </Button>
                    </>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="stack gap-3">
              <div className={cn('stack', 'gap-2')}>
                {[
                  [order.orderStatus === ORDER_STATUS.OUT_FOR_DELIVERY, 'Picked up'],
                  [allChecked, 'Items verified'],
                  [settled, 'Payment settled'],
                ].map(([done, label]) => (
                  <span className="row gap-2" key={label}>
                    <Icon name={done ? 'check' : 'x'} size={14}
                      style={{ color: done ? 'var(--success)' : 'var(--text-subtle)' }} />
                    <span className={done ? undefined : 'subtle'} style={{ fontSize: 'var(--fs-sm)' }}>{label}</span>
                  </span>
                ))}
              </div>
              <Button variant="primary" size="lg" block icon="check" disabled={!canDeliver} loading={busy} onClick={deliver}>
                Mark delivered
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
