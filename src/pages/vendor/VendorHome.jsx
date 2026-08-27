import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Icon from '../../components/feedback/Icon';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import ProductCard from './ProductCard';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { listProducts } from '../../services/productService';
import { listBanners } from '../../services/couponService';
import { listCoupons } from '../../services/couponService';
import { MEDICINE_CATEGORIES } from '../../constants/catalog';
import { currency } from '../../utils/format';

const CATEGORY_ICON = {
  'Lifesaving Injections': 'thermometer',
  Vaccines: 'shield',
  Medicine: 'pill',
};

/** The storefront home: banner carousel, categories, featured and best sellers. */
export default function VendorHome() {
  const { session } = useAuth();
  const products = useAsync(listProducts, []);
  const banners = useAsync(listBanners, []);
  const coupons = useAsync(listCoupons, []);
  const [slide, setSlide] = useState(0);

  const live = useMemo(() => (banners.data || []).filter((b) => b.active), [banners.data]);

  // Auto-advancing carousel, like the app's promo carousel.
  useEffect(() => {
    if (live.length < 2) return undefined;
    const t = setInterval(() => setSlide((s) => (s + 1) % live.length), 6000);
    return () => clearInterval(t);
  }, [live.length]);

  const active = useMemo(() => (products.data || []).filter((p) => p.active), [products.data]);
  const featured = useMemo(() => active.filter((p) => p.badge).slice(0, 8), [active]);
  const bestSellers = useMemo(
    () => [...active].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 8),
    [active],
  );
  const liveCoupons = useMemo(
    () => (coupons.data || []).filter((c) => c.active && !c.expired).slice(0, 3),
    [coupons.data],
  );

  const banner = live[slide];

  return (
    <>
      <section className="section">
        <h1 style={{ fontSize: 'var(--fs-xl)' }}>
          {session?.name ? `Welcome back, ${session.name}` : 'Welcome back'}
        </h1>
        <p className="page__sub">Order medicines, vaccines and lifesaving injections for your counter.</p>
      </section>

      {banner && (
        <section className="section">
          <Link
            to={banner.categoryId ? `/shop/products?category=${encodeURIComponent(banner.categoryId)}` : '/shop/products'}
            style={{
              display: 'block',
              position: 'relative',
              minHeight: 190,
              padding: 'var(--sp-8)',
              borderRadius: 'var(--r-xl)',
              color: '#fff',
              overflow: 'hidden',
              background: banner.image?.url
                ? `url(${banner.image.url}) center/cover`
                : `linear-gradient(135deg, ${banner.startColor}, ${banner.endColor})`,
            }}
          >
            <span className="badge" style={{ background: 'rgba(255,255,255,.22)', color: '#fff' }}>{banner.tag}</span>
            <p style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginTop: 10, maxWidth: '22ch', lineHeight: 1.2 }}>
              {banner.title}
            </p>
            <span className="row gap-2" style={{ marginTop: 14, fontWeight: 700 }}>
              {banner.ctaLabel} <Icon name="arrowRight" size={15} />
            </span>

            {live.length > 1 && (
              <span className="row gap-2" style={{ position: 'absolute', bottom: 20, right: 24 }}>
                {live.map((b, i) => (
                  <span
                    key={b._id}
                    style={{
                      width: i === slide ? 20 : 7, height: 7, borderRadius: 99,
                      background: i === slide ? '#fff' : 'rgba(255,255,255,.5)',
                      transition: 'width var(--t-base) var(--ease)',
                    }}
                  />
                ))}
              </span>
            )}
          </Link>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Shop by category</h2>
          <Button size="sm" variant="ghost" iconRight="arrowRight" to="/shop/products">Browse everything</Button>
        </div>
        <div className="grid grid--3">
          {MEDICINE_CATEGORIES.map((c) => (
            <Link
              key={c}
              to={`/shop/products?category=${encodeURIComponent(c)}`}
              className="card card--pad row gap-4"
            >
              <span className="stat__icon" style={{ width: 44, height: 44, borderRadius: 14 }}>
                <Icon name={CATEGORY_ICON[c]} size={20} />
              </span>
              <span>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--fs-md)' }}>{c}</span>
                <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                  {active.filter((p) => p.category === c).length} products
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {liveCoupons.length > 0 && (
        <section className="section">
          <div className="section__head"><h2 className="section__title">Offers for you</h2></div>
          <div className="grid grid--3">
            {liveCoupons.map((c) => (
              <div key={c._id} className="card card--pad row gap-4">
                <span className="stat__icon stat--accent" style={{ width: 40, height: 40, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                  <Icon name="tag" size={17} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="mono" style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{c.code}</p>
                  <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{c.description}</p>
                  {c.maxDiscount && (
                    <p className="field__hint">Up to {currency(c.maxDiscount)} off</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Featured</h2>
          <Button size="sm" variant="ghost" iconRight="arrowRight" to="/shop/products">See all</Button>
        </div>
        <div className="grid grid--cards">
          {products.loading ? <CardSkeleton count={4} />
            : featured.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Best sellers</h2>
          <Button size="sm" variant="ghost" iconRight="arrowRight" to="/shop/products">See all</Button>
        </div>
        <div className="grid grid--cards">
          {products.loading ? <CardSkeleton count={4} />
            : bestSellers.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      </section>
    </>
  );
}
