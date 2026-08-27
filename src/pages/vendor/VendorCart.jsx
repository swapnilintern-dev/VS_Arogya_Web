import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import QtyStepper from '../../components/common/QtyStepper';
import { Input } from '../../components/forms/Input';
import EmptyState from '../../components/feedback/EmptyState';
import ProductThumb from '../../features/ProductThumb';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { listCoupons } from '../../services/couponService';
import { currency, number } from '../../utils/format';
import { VENDOR_LOW_STOCK_THRESHOLD } from '../../constants/catalog';

/** Cart lines on the left, a sticky order summary on the right. */
export default function VendorCart() {
  const cart = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const coupons = useAsync(listCoupons, []);

  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(null);

  const apply = () => {
    const match = (coupons.data || []).find(
      (c) => c.code === code.trim().toUpperCase() && c.active && !c.expired,
    );
    if (!match) {
      toast.error('That code is not valid, or it has expired.');
      return;
    }
    setApplied(match);
    toast.success(`${match.code} applied.`);
  };

  const discount = applied
    ? Math.min(cart.subtotal * (applied.percentOff / 100), applied.maxDiscount || Infinity)
    : 0;
  const payable = Math.max(0, cart.subtotal - discount);

  const clear = async () => {
    const ok = await confirm({
      title: 'Empty your cart?',
      message: 'Every line is removed. Saved items are not affected.',
      confirmLabel: 'Empty cart',
    });
    if (ok) { await cart.clear(); toast.success('Cart emptied.'); }
  };

  if (cart.lines.length === 0) {
    return (
      <>
        <PageHeader title="Your cart" />
        <Card>
          <EmptyState
            icon="cart"
            title="Your cart is empty"
            text="Browse the catalogue and add what your counter needs."
            action={<Button variant="primary" icon="arrowRight" to="/shop/products">Browse the catalogue</Button>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {confirmUi}
      <PageHeader
        title="Your cart"
        sub={`${number(cart.itemCount)} unit(s) across ${cart.lines.length} product(s)`}
        actions={<Button variant="ghost" icon="trash" onClick={clear}>Empty cart</Button>}
      />

      <div className="split">
        <Card>
          <CardHead title="Items" />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="cell-num">Price</th>
                  <th>Quantity</th>
                  <th className="cell-num">Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((l) => {
                  const low = l.product.stock <= VENDOR_LOW_STOCK_THRESHOLD;
                  const over = l.quantity > l.product.stock;
                  return (
                    <tr key={l.product._id}>
                      <td>
                        <span className="row gap-3">
                          <ProductThumb product={l.product} />
                          <span style={{ minWidth: 0 }}>
                            <Link to={`/shop/products/${l.product._id}`} className="truncate" style={{ display: 'block', fontWeight: 600 }}>
                              {l.product.title}
                            </Link>
                            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                              {l.product.brand} · {l.product.packInfo}
                            </span>
                            {over && <Badge tone="danger" dot>Only {l.product.stock} in stock</Badge>}
                            {!over && low && <Badge tone="warning" dot>Low stock</Badge>}
                          </span>
                        </span>
                      </td>
                      <td className="cell-num">{currency(l.product.price)}</td>
                      <td>
                        <QtyStepper
                          size="sm"
                          value={l.quantity}
                          max={l.product.stock}
                          disabled={cart.busy}
                          onChange={(q) => (q > l.quantity ? cart.increase(l.product._id) : cart.decrease(l.product._id))}
                          onRemove={() => cart.remove(l.product._id)}
                        />
                      </td>
                      <td className="cell-num"><strong>{currency(l.product.price * l.quantity)}</strong></td>
                      <td className="cell-actions">
                        <Button size="sm" variant="ghost" icon="trash" disabled={cart.busy}
                          onClick={() => cart.remove(l.product._id)} aria-label="Remove item" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="rail">
          <Card>
            <CardHead title="Order summary" />
            <CardBody className="stack gap-4">
              <div className="stack gap-2">
                <span className="field__label">Have a coupon?</span>
                <div className="row gap-2">
                  <Input
                    placeholder="Enter code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={!!applied}
                  />
                  {applied
                    ? <Button variant="ghost" icon="x" onClick={() => { setApplied(null); setCode(''); }}>Remove</Button>
                    : <Button variant="secondary" onClick={apply} disabled={!code.trim()}>Apply</Button>}
                </div>
                {applied && (
                  <span className="row gap-2">
                    <Badge tone="success" dot>{applied.code}</Badge>
                    <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{applied.description}</span>
                  </span>
                )}
              </div>

              <KeyValue rows={[
                { label: `Subtotal (${number(cart.itemCount)} units)`, value: currency(cart.subtotal) },
                { label: 'GST (included)', value: currency(cart.gst) },
                applied ? { label: `Discount · ${applied.code}`, value: `− ${currency(discount)}` } : null,
                { label: 'Payable', value: currency(payable), total: true },
              ]} />

              <Button
                variant="primary" size="lg" block iconRight="arrowRight"
                onClick={() => navigate('/shop/checkout', { state: { coupon: applied } })}
              >
                Proceed to checkout
              </Button>
              <Link to="/shop/products" className="btn btn--ghost btn--block">Continue shopping</Link>
            </CardBody>
          </Card>

          <Note tone="info">
            Prices are GST-inclusive. Your tax invoice is generated the moment the order is accepted, with the
            batch and expiry of every line recorded on it.
          </Note>
        </div>
      </div>
    </>
  );
}
