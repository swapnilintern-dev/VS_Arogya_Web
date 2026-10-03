import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import QtyStepper from '../../components/common/QtyStepper';
import Icon from '../../components/feedback/Icon';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import ProductCard from './ProductCard';
import useAsync from '../../hooks/useAsync';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getProduct, listProducts, toggleSavedProduct, listSavedProducts } from '../../services/productService';
import { currency, number } from '../../utils/format';
import { stockStatusOf, STOCK_STATUS } from '../../utils/stock';
import { discountPercentFor, priceFor, TIER_LABEL } from '../../utils/pricing';
import { VENDOR_LOW_STOCK_THRESHOLD } from '../../constants/catalog';

const ICON_BY_CATEGORY = {
  'Lifesaving Injections': 'thermometer',
  Vaccines: 'shield',
  Medicine: 'pill',
};

/** Gallery on the left, buy box on the right — the desktop product page. */
export default function VendorProductDetail() {
  const { id } = useParams();
  const cart = useCart();
  const { pricingTier } = useAuth();
  const toast = useToast();
  const { data: product, loading, error, reload } = useAsync(() => getProduct(id), [id]);
  const all = useAsync(listProducts, []);

  const [qty, setQty] = useState(1);
  const [image, setImage] = useState(0);
  const [saved, setSaved] = useState(false);

  // Saved state lives on the vendor's account (GET /all-saved).
  useEffect(() => {
    let alive = true;
    listSavedProducts()
      .then((rows) => { if (alive) setSaved(rows.some((p) => p._id === id)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [id]);

  const related = useMemo(
    () => (all.data || []).filter((p) => p.active && p.category === product?.category && p._id !== id).slice(0, 4),
    [all.data, product, id],
  );

  if (loading) return <DetailSkeleton back={'/shop'} crumbs={[{ label: 'Shop', to: '/shop' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!product) return <ErrorState error={{ message: 'This product is no longer in the catalogue.' }} />;

  const out = stockStatusOf(product.stock, product.lowThreshold) === STOCK_STATUS.OUT;
  const low = !out && product.stock <= VENDOR_LOW_STOCK_THRESHOLD;
  // A hospital/clinic or wholesale account is on its own rate card
  // (drDisPercent / wholesellerPercent); retail gets tierOff === 0.
  const tierOff = discountPercentFor(product, pricingTier);
  const payable = priceFor(product, pricingTier);
  const off = product.mrp && product.mrp > payable ? Math.round((1 - payable / product.mrp) * 100) : 0;
  const images = product.image?.length ? product.image : [];
  const line = cart.lineFor(product._id);

  const add = async () => {
    try {
      await cart.add(product, qty);
      toast.success(`${qty} × ${product.title} added to cart.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleSave = async () => {
    try {
      const { saved: next } = await toggleSavedProduct(product._id);
      setSaved(next);
      toast.success(next ? 'Saved for later.' : 'Removed from saved items.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        back="/shop"
        crumbs={[
          { label: 'Shop', to: '/shop' },
          { label: product.category, to: `/shop?category=${encodeURIComponent(product.category)}` },
          { label: product.title },
        ]}
        title={product.title}
        sub={`${product.brand} · ${product.packInfo}`}
      />

      <div className="split split--wide-rail">
        <div className="stack gap-4">
          <Card>
            <div
              style={{
                aspectRatio: '16 / 9',
                background: 'var(--brand-050)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--brand-500)',
                borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
                overflow: 'hidden',
              }}
            >
              {images[image]?.url
                ? <img src={images[image].url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <Icon name={ICON_BY_CATEGORY[product.category] || 'pill'} size={72} strokeWidth={1} />}
            </div>
            {images.length > 1 && (
              <CardBody className="row gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImage(i)}
                    className="thumb"
                    style={{ borderColor: i === image ? 'var(--brand-500)' : 'var(--border)' }}
                  >
                    {img.url ? <img src={img.url} alt="" /> : <Icon name="image" size={14} />}
                  </button>
                ))}
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHead title="About this product" />
            <CardBody className="stack gap-4">
              <p style={{ lineHeight: 1.65, color: 'var(--text-muted)' }}>{product.description}</p>
              <KeyValue rows={[
                { label: 'Brand', value: product.brand },
                { label: 'Manufacturer', value: product.manufacturer },
                { label: 'Marketed by', value: product.marketedBy },
                { label: 'Pack', value: product.packInfo },
                { label: 'Units per pack', value: number(product.packOf) },
                { label: 'Category', value: product.category },
                { label: 'HSN code', value: <span className="mono">{product.hsnCode}</span> },
                { label: 'GST', value: `${product.gstPercent}% (included in the price)` },
                { label: 'Storage', value: product.cold_stored === 'yes' ? 'Cold chain — 2°C to 8°C, do not freeze' : 'Below 25°C, dry and out of sunlight' },
              ]} />
            </CardBody>
          </Card>

          {related.length > 0 && (
            <section>
              <div className="section__head"><h2 className="section__title">More in {product.category}</h2></div>
              <div className="grid grid--cards">
                {related.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
            </section>
          )}
        </div>

        <div className="rail">
          <Card>
            <CardBody className="stack gap-4">
              <div className="row gap-2 wrap">
                {product.badge && <Badge tone="accent">{product.badge}</Badge>}
                {product.prescriptionRequired && <Badge tone="warning">Prescription required</Badge>}
                {product.cold_stored === 'yes' && <Badge tone="info">Cold chain</Badge>}
              </div>

              <div>
                {tierOff > 0 && (
                  <p className="field__label" style={{ marginBottom: 2 }}>{TIER_LABEL[pricingTier]}</p>
                )}
                <div className="row gap-3" style={{ alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>{currency(payable)}</span>
                  {tierOff > 0 ? (
                    <>
                      <span className="subtle" style={{ textDecoration: 'line-through' }}>{currency(product.price)}</span>
                      <Badge tone="accent">{Math.round(tierOff)}% {TIER_LABEL[pricingTier].toLowerCase()}</Badge>
                    </>
                  ) : off > 0 && (
                    <>
                      <span className="subtle" style={{ textDecoration: 'line-through' }}>{currency(product.mrp)}</span>
                      <Badge tone="success">{off}% off</Badge>
                    </>
                  )}
                </div>
                <p className="field__hint">Price per {product.packInfo?.toLowerCase() || 'pack'}, GST included</p>
              </div>

              {out
                ? <Note tone="danger">Out of stock. Check back or contact your area agent for an ETA.</Note>
                : low
                  ? <Note tone="warning">Only {product.stock} left in the warehouse — order soon.</Note>
                  : <Badge tone="success" dot>In stock · {number(product.stock)} available</Badge>}

              {product.prescriptionRequired && !out && (
                <Note tone="info">
                  This is a prescription product. Your drug licence on file covers wholesale purchase; keep the
                  prescription record at your counter as required.
                </Note>
              )}

              {!out && (
                <>
                  <div className="between">
                    <span className="field__label">Quantity</span>
                    <QtyStepper value={qty} onChange={setQty} max={product.stock} />
                  </div>
                  <KeyValue rows={[
                    { label: `${qty} × ${currency(payable)}`, value: currency(payable * qty), total: true },
                  ]} />
                  <Button variant="primary" size="lg" block icon="cart" loading={cart.busy} onClick={add}>
                    Add to cart
                  </Button>
                  {line && (
                    <Link to="/shop/cart" className="btn btn--soft btn--block">
                      {line.quantity} already in your cart — view cart
                    </Link>
                  )}
                </>
              )}

              <Button variant="secondary" block icon="heart" onClick={toggleSave}>
                {saved ? 'Saved' : 'Save for later'}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Delivery & billing" />
            <CardBody className="stack gap-3">
              {[
                ['truck', 'Delivered to your registered address'],
                ['file', 'GST tax invoice issued once the order is accepted'],
                ['shield', 'Batch and expiry recorded on every line'],
                ['refresh', 'Cancel any time before it ships'],
              ].map(([icon, text]) => (
                <span className="row gap-3" key={text}>
                  <Icon name={icon} size={15} />
                  <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{text}</span>
                </span>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
