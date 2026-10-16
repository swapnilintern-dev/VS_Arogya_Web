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
import { MEDICAL_DISCLAIMER, NOT_AVAILABLE, clean, listOf, splitDescription } from '../../constants/medicine';

const ICON_BY_CATEGORY = {
  'Lifesaving Injections': 'thermometer',
  Vaccines: 'shield',
  Medicine: 'pill',
};

/** One collapsible medicine-information section; empty ones say so plainly. */
function InfoSection({ title, open = false, children, empty }) {
  return (
    <details className="med-section" open={open}>
      <summary>{title}</summary>
      <div className="med-section__body">
        {empty ? <p className="subtle">{NOT_AVAILABLE}</p> : children}
      </div>
    </details>
  );
}

const Bullets = ({ items }) => (
  <ul className="med-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>
);

/** Gallery on the left, buy box on the right — the desktop product page. */
export default function VendorProductDetail() {
  const { id } = useParams();
  const cart = useCart();
  const { pricingTier, canSeePrices } = useAuth();
  const toast = useToast();
  const { data: product, loading, error, reload } = useAsync(() => getProduct(id), [id]);
  const all = useAsync(listProducts, []);

  const [qty, setQty] = useState(1);
  const [image, setImage] = useState(0);
  const [saved, setSaved] = useState(false);

  // Moving to another product (e.g. from "More in …") must not carry over the
  // previous product's quantity, image index or saved flag.
  useEffect(() => {
    setQty(1);
    setImage(0);
    setSaved(false);
  }, [id]);

  // Saved state lives on the vendor's account (GET /all-saved), which is
  // behind the auth gate — a guest has no account and the server refuses the
  // call, so it is never made.
  useEffect(() => {
    if (!canSeePrices) return undefined;
    let alive = true;
    listSavedProducts()
      .then((rows) => { if (alive) setSaved(rows.some((p) => p._id === id)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [id, canSeePrices]);

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

  // Medicine information — straight from this product's own record.
  const composition = clean(product.composition);
  const { intro, usesList } = splitDescription(product.description);
  // Only drop the description's trailing summary block when the structured
  // fields it repeats are actually present.
  const about = composition ? intro : clean(product.description);
  const uses = usesList.length ? usesList : listOf(product.uses);
  const directions = clean(product.directions);
  const sideEffects = listOf(product.sideEffects);
  const precautions = clean(product.precautions);
  const coldChain = product.cold_stored === 'yes';
  const storage = clean(product.storage) || (coldChain ? 'Cold chain — store between 2°C and 8°C. Do not freeze.' : '');

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
        sub={[clean(product.brand), clean(product.packInfo)].filter(Boolean).join(' · ') || undefined}
      />

      <div className="split split--wide-rail pdp">
        <div className="stack gap-4">
          <Card className="pdp__media">
            <div
              style={{
                // Without a photo a 16:9 tile is mostly empty space.
                aspectRatio: images.length ? '16 / 9' : '4 / 1',
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
                : <Icon name={ICON_BY_CATEGORY[product.category] || 'pill'} size={56} strokeWidth={1} />}
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
              {about && <p style={{ lineHeight: 1.65, color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>{about}</p>}
              {/* Manufacturer, category, pack, units per pack, HSN and GST stay on the
                  record (admin, invoices, pricing); they are just not shown to buyers here. */}
              <KeyValue rows={[
                clean(product.brand) && { label: 'Brand', value: clean(product.brand) },
                composition && { label: 'Composition', value: composition },
                storage && { label: 'Storage', value: storage },
                clean(product.marketedBy) && { label: 'Marketed by', value: clean(product.marketedBy) },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Medicine information" sub="From this product's record. Tap a section to expand it." />
            <CardBody className="stack gap-2">
              <InfoSection title="Composition" open empty={!composition}>
                <p>{composition}</p>
              </InfoSection>
              <InfoSection title="Uses" open empty={!uses.length}>
                {uses.length > 1 ? <Bullets items={uses} /> : <p>{uses[0]}</p>}
              </InfoSection>
              <InfoSection title="Directions for use" empty={!directions}>
                <p>{directions}</p>
              </InfoSection>
              <InfoSection title={sideEffects.length ? `Side effects (${sideEffects.length})` : 'Side effects'} empty={!sideEffects.length}>
                <Bullets items={sideEffects} />
              </InfoSection>
              <InfoSection title="Precautions and warnings" empty={!precautions}>
                <p>{precautions}</p>
              </InfoSection>
              <InfoSection title="Storage instructions" empty={!storage}>
                <p>{storage}</p>
              </InfoSection>
            </CardBody>
          </Card>

          <Note tone="info" icon="shield">
            <strong>Medical Information Disclaimer:</strong> {MEDICAL_DISCLAIMER}
          </Note>

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

              {!canSeePrices ? (
                <Note tone="info" icon="store">
                  <strong>Prices are for registered pharmacies.</strong> Register your business and, once
                  the VS Arogya team approves it, distributor prices and ordering open up here.
                </Note>
              ) : (
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
              )}

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

              {!canSeePrices && (
                <Button variant="primary" size="lg" block icon="store" to="/register">
                  Register as a vendor
                </Button>
              )}

              {canSeePrices && !out && (
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

              {canSeePrices && (
                <Button variant="secondary" block icon="heart" onClick={toggleSave}>
                  {saved ? 'Saved' : 'Save for later'}
                </Button>
              )}
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
