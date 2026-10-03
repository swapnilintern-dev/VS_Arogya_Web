import { Link } from 'react-router-dom';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Icon from '../../components/feedback/Icon';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { currency } from '../../utils/format';
import { discountPercentFor, priceFor, TIER_LABEL } from '../../utils/pricing';
import { stockStatusOf, STOCK_STATUS } from '../../utils/stock';
import { VENDOR_LOW_STOCK_THRESHOLD } from '../../constants/catalog';

const ICON_BY_CATEGORY = {
  'Lifesaving Injections': 'thermometer',
  Vaccines: 'shield',
  Medicine: 'pill',
};

/**
 * The storefront catalogue card.
 *
 * The vendor-facing low-stock warning uses its own, higher threshold than the
 * staff-side one: staff ask "should I reorder?", a buyer asks "should I buy now
 * before it runs out?".
 *
 * A hospital/clinic or wholesale account is on its own rate card
 * (drDisPercent / wholesellerPercent). Retail accounts get tierOff === 0, where
 * this renders exactly as it always did.
 */
export default function ProductCard({ product }) {
  const cart = useCart();
  const { pricingTier } = useAuth();
  const toast = useToast();

  const out = stockStatusOf(product.stock, product.lowThreshold) === STOCK_STATUS.OUT;
  const low = !out && product.stock <= VENDOR_LOW_STOCK_THRESHOLD;
  const tierOff = discountPercentFor(product, pricingTier);
  const payable = priceFor(product, pricingTier);
  const off = product.mrp && product.mrp > payable
    ? Math.round((1 - payable / product.mrp) * 100)
    : 0;
  const line = cart.lineFor(product._id);

  const add = async () => {
    try {
      await cart.add(product);
      toast.success(`${product.title} added to cart.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <article className="pcard">
      <Link to={`/shop/products/${product._id}`} className="pcard__media">
        {product.image?.[0]?.url
          ? <img src={product.image[0].url} alt={product.title} loading="lazy" />
          : <Icon name={ICON_BY_CATEGORY[product.category] || 'pill'} size={40} strokeWidth={1.2} />}
        <span className="pcard__flags">
          {product.badge && <Badge tone="accent">{product.badge}</Badge>}
          {off > 0 && <Badge tone="success">{off}% off</Badge>}
          {product.prescriptionRequired && <Badge tone="warning">Rx</Badge>}
          {product.cold_stored === 'yes' && <Badge tone="info">2–8°C</Badge>}
        </span>
      </Link>

      <div className="pcard__body">
        <span className="pcard__brand">{product.brand}</span>
        <Link to={`/shop/products/${product._id}`} className="pcard__title">{product.title}</Link>
        <span className="pcard__pack">{product.packInfo}</span>
        <div className="pcard__price-row">
          <span className="pcard__price">{currency(payable)}</span>
          {tierOff > 0
            ? <span className="pcard__mrp">{currency(product.price)}</span>
            : off > 0 && <span className="pcard__mrp">{currency(product.mrp)}</span>}
        </div>
        {tierOff > 0 && (
          <Badge tone="accent">{Math.round(tierOff)}% {TIER_LABEL[pricingTier].toLowerCase()}</Badge>
        )}
        {out
          ? <Badge tone="danger" dot>Out of stock</Badge>
          : low
            ? <Badge tone="warning" dot>Only {product.stock} left</Badge>
            : <Badge tone="success" dot>In stock</Badge>}
      </div>

      <div className="pcard__foot">
        {line ? (
          <Button variant="soft" block icon="check" to="/shop/cart">
            {line.quantity} in cart
          </Button>
        ) : (
          <Button variant="primary" block icon="cart" disabled={out || cart.busy} onClick={add}>
            Add to cart
          </Button>
        )}
      </div>
    </article>
  );
}
