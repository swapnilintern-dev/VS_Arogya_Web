import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import Icon from '../../components/feedback/Icon';
import Spinner from '../../components/feedback/Spinner';
import EmptyState from '../../components/feedback/EmptyState';
import ProductThumb from '../../features/ProductThumb';
import useAsync from '../../hooks/useAsync';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { listAddresses } from '../../services/vendorService';
import { placeOrder, verifyPayment } from '../../services/orderService';
import { openRazorpayCheckout } from '../../utils/razorpay';
import { PAYMENT_METHOD } from '../../constants/orders';
import { currency, number } from '../../utils/format';
import cn from '../../utils/cn';

/** Address, payment method and summary — the three things checkout decides. */
export default function VendorCheckout() {
  const cart = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const addresses = useAsync(listAddresses, []);
  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState(PAYMENT_METHOD.ONLINE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (addresses.data?.length && !addressId) {
      setAddressId((addresses.data.find((a) => a.isDefault) || addresses.data[0])._id);
    }
  }, [addresses.data, addressId]);

  const address = addresses.data?.find((a) => a._id === addressId);
  const payable = cart.subtotal;

  const submit = async () => {
    if (!address) { toast.error('Choose a delivery address first.'); return; }
    setBusy(true);
    try {
      // The server places the order from ITS copy of the cart, then records the
      // payment method. For ONLINE it also mints the Razorpay order.
      const order = await placeOrder({ address, paymentMethod: method });
      await cart.refresh();
      toast.success(`${order.orderNo} placed.`);

      if (method === PAYMENT_METHOD.ONLINE && order.payment?.razorpayOrderId) {
        try {
          // Razorpay's sheet collects the payment; the SERVER verifies the
          // signature — nothing is marked paid from this page.
          const result = await openRazorpayCheckout({
            key: order.payment.razorpayKeyId,
            amount: order.payment.amount,
            currency: order.payment.currency,
            orderId: order.payment.razorpayOrderId,
            name: 'VS Arogya',
            description: order.orderNo,
            prefill: { name: session?.name || '', contact: session?.mobile || '' },
          });
          await verifyPayment(result);
          toast.success('Payment confirmed.');
        } catch (err) {
          toast.info(err.message || 'Payment not completed — you can pay from the order page.');
        }
      } else if (method === PAYMENT_METHOD.ONLINE) {
        toast.info('Online payment could not be started — pay from the order page.');
      }
      navigate(`/shop/orders/${order._id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  if (cart.lines.length === 0) {
    return (
      <>
        <PageHeader title="Checkout" />
        <Card>
          <EmptyState
            icon="cart"
            title="Nothing to check out"
            text="Your cart is empty."
            action={<Button variant="primary" to="/shop">Browse medicines</Button>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader back="/shop/cart" title="Checkout" sub="Confirm where it goes and how you'll pay." />

      <div className="split split--wide-rail">
        <div className="stack gap-4">
          <Card>
            <CardHead
              title="Delivery address"
              actions={<Button size="sm" variant="ghost" icon="plus" to="/shop/addresses">Manage addresses</Button>}
            />
            <CardBody>
              {addresses.loading && <Spinner />}
              {!addresses.loading && !addresses.data?.length && (
                <EmptyState
                  icon="pin"
                  title="No saved addresses"
                  text="Add the address this order should be delivered to."
                  action={<Button variant="primary" to="/shop/addresses">Add an address</Button>}
                />
              )}
              <div className="stack gap-2">
                {addresses.data?.map((a) => (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => setAddressId(a._id)}
                    className="row gap-3"
                    style={{
                      textAlign: 'left',
                      padding: 'var(--sp-3) var(--sp-4)',
                      border: `1px solid ${addressId === a._id ? 'var(--brand-500)' : 'var(--border)'}`,
                      background: addressId === a._id ? 'var(--brand-050)' : 'var(--surface)',
                      borderRadius: 'var(--r-md)',
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flex: 'none', background: '#fff',
                      border: `5px solid ${addressId === a._id ? 'var(--brand-700)' : 'var(--border-strong)'}`,
                    }} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="row gap-2">
                        <strong>{a.label}</strong>
                        {a.isDefault && <Badge tone="muted">Default</Badge>}
                      </span>
                      <span className="subtle" style={{ display: 'block', fontSize: 'var(--fs-sm)' }}>
                        {a.fullName} · {a.phone}
                      </span>
                      <span className="subtle" style={{ display: 'block', fontSize: 'var(--fs-sm)' }}>
                        {a.line1}, {a.city}, {a.state} — {a.pincode}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Payment method" />
            <CardBody className="stack gap-2">
              {[
                [PAYMENT_METHOD.ONLINE, 'qr', 'Pay online', 'UPI, cards, net banking and wallets through Razorpay. The payment is confirmed by the server.'],
                [PAYMENT_METHOD.COD, 'rupee', 'Cash on delivery', 'Settle with the delivery partner at your counter.'],
              ].map(([value, icon, title, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={cn('row', 'gap-3')}
                  style={{
                    textAlign: 'left',
                    padding: 'var(--sp-3) var(--sp-4)',
                    border: `1px solid ${method === value ? 'var(--brand-500)' : 'var(--border)'}`,
                    background: method === value ? 'var(--brand-050)' : 'var(--surface)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <span className="stat__icon"><Icon name={icon} size={15} /></span>
                  <span className="grow">
                    <strong style={{ display: 'block' }}>{title}</strong>
                    <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{text}</span>
                  </span>
                  {method === value && <Icon name="check" size={16} strokeWidth={2.6} />}
                </button>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHead title={`Items (${cart.lines.length})`} />
            <CardBody className="stack gap-3">
              {cart.lines.map((l) => (
                <div className="row gap-3" key={l.product._id}>
                  <ProductThumb product={l.product} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{l.product.title}</span>
                    <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                      {number(l.quantity)} × {currency(l.product.price)}
                    </span>
                  </span>
                  <strong>{currency(l.product.price * l.quantity)}</strong>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Summary" />
            <CardBody className="stack gap-4">
              <KeyValue rows={[
                { label: `Subtotal (${number(cart.itemCount)} units)`, value: currency(cart.subtotal) },
                { label: 'GST (included)', value: currency(cart.gst) },
                { label: 'Delivery', value: 'Free' },
                { label: 'Total payable', value: currency(payable), total: true },
              ]} />

              <Button
                variant="primary" size="lg" block icon="check"
                loading={busy}
                disabled={!address}
                onClick={submit}
              >
                Place order
              </Button>

              <p className="subtle text-center" style={{ fontSize: 'var(--fs-xs)' }}>
                The order enters as Pending. Once our team accepts it, your tax invoice is generated and the
                stock is allocated from the nearest-expiry batches.
              </p>
            </CardBody>
          </Card>

          {method === PAYMENT_METHOD.ONLINE && (
            <Note tone="info">
              Payment is confirmed by the server after Razorpay reports it — nothing is marked paid from this
              browser. You can watch the status on the order page.
            </Note>
          )}

          <Link to="/shop/cart" className="btn btn--ghost btn--block">Back to cart</Link>
        </div>
      </div>
    </>
  );
}
