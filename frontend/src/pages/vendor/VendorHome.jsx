import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import Chip from '../../components/common/Chip';
import Icon from '../../components/feedback/Icon';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { SearchInput, Select } from '../../components/forms/Input';
import Pagination from '../../components/tables/Pagination';
import ProductCard from './ProductCard';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { listProducts } from '../../services/productService';
import { listBanners, listCoupons } from '../../services/couponService';
import { categoriesOf, sameCategory } from '../../utils/categories';
import { currency, number } from '../../utils/format';
import { stockStatusOf, STOCK_STATUS } from '../../utils/stock';

const CATEGORY_ICON = {
  'lifesaving injections': 'thermometer',
  vaccines: 'shield',
  medicine: 'pill',
};

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'name', label: 'Name A–Z' },
];

const PAGE_SIZE = 24;

/**
 * The storefront home — and the whole shop. Banner carousel, categories and
 * offers up top; below, every product with search, filters and sorting. The
 * top-bar search and the category cards land here with `?q=` / `?category=`.
 */
export default function VendorHome() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const products = useAsync(listProducts, []);
  const banners = useAsync(listBanners, []);
  const coupons = useAsync(listCoupons, []);
  const [slide, setSlide] = useState(0);

  const [query, setQuery] = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [sort, setSort] = useState('relevance');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [rxOnly, setRxOnly] = useState(false);
  const [coldOnly, setColdOnly] = useState(false);
  const [page, setPage] = useState(1);
  const q = useDebounce(query, 250);

  // The top-bar search navigates here with a fresh `?q=`; pick it up.
  useEffect(() => {
    const next = params.get('q') || '';
    const nextCat = params.get('category') || '';
    setQuery((cur) => (cur === next ? cur : next));
    setCategory((cur) => (cur === nextCat ? cur : nextCat));
  }, [params]);

  // Keep the URL in step so a filtered view is shareable and back works.
  useEffect(() => {
    const next = {};
    if (q.trim()) next.q = q.trim();
    if (category) next.category = category;
    const current = Object.fromEntries(params.entries());
    if (JSON.stringify(next) !== JSON.stringify(current)) setParams(next, { replace: true });
    setPage(1);
  }, [q, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useMemo(() => (banners.data || []).filter((b) => b.active !== false), [banners.data]);

  // Auto-advancing carousel, like the app's promo carousel.
  useEffect(() => {
    if (live.length < 2) return undefined;
    const t = setInterval(() => setSlide((s) => (s + 1) % live.length), 6000);
    return () => clearInterval(t);
  }, [live.length]);

  const active = useMemo(() => (products.data || []).filter((p) => p.active !== false), [products.data]);

  const categories = useMemo(() => categoriesOf(active), [active]);

  const countIn = (c) => active.filter((p) => sameCategory(p.category, c)).length;

  const featured = useMemo(() => active.filter((p) => p.badge).slice(0, 8), [active]);
  const bestSellers = useMemo(
    () => [...active].sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)).slice(0, 8),
    [active],
  );
  const liveCoupons = useMemo(
    () => (coupons.data || []).filter((c) => c.active && !c.expired).slice(0, 3),
    [coupons.data],
  );

  const results = useMemo(() => {
    let rows = active;
    const term = q.trim().toLowerCase();
    if (term) {
      rows = rows.filter((p) =>
        [p.title, p.brand, p.category, p.code, p.manufacturer]
          .some((f) => String(f || '').toLowerCase().includes(term)));
    }
    if (category) rows = rows.filter((p) => sameCategory(p.category, category));
    if (inStockOnly) rows = rows.filter((p) => stockStatusOf(p.stock, p.lowThreshold) !== STOCK_STATUS.OUT);
    if (rxOnly) rows = rows.filter((p) => p.prescriptionRequired);
    if (coldOnly) rows = rows.filter((p) => p.cold_stored === 'yes');

    const sorted = [...rows];
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    if (sort === 'discount') sorted.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    if (sort === 'name') sorted.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return sorted;
  }, [active, q, category, sort, inStockOnly, rxOnly, coldOnly]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const paged = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filtersOn = !!(q.trim() || category || inStockOnly || rxOnly || coldOnly);
  const clearAll = () => {
    setQuery(''); setCategory(''); setInStockOnly(false); setRxOnly(false); setColdOnly(false); setSort('relevance');
  };

  const banner = live[slide];
  const browseLink = (c) => `/shop?category=${encodeURIComponent(c)}`;

  return (
    <>
      <section className="section">
        <h1 style={{ fontSize: 'var(--fs-xl)' }}>
          {session?.name ? `Welcome back, ${session.name}` : 'Welcome back'}
        </h1>
        <p className="page__sub">Order medicines, vaccines and lifesaving injections for your counter.</p>
      </section>

      {!filtersOn && banner && (
        <section className="section">
          <Link
            to={banner.categoryId ? browseLink(banner.categoryId) : '/shop'}
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

      {!filtersOn && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Shop by category</h2>
          </div>
          <div className="grid grid--3">
            {categories.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className="card card--pad row gap-4"
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <span className="stat__icon" style={{ width: 44, height: 44, borderRadius: 14 }}>
                  <Icon name={CATEGORY_ICON[c.toLowerCase()] || 'pill'} size={20} />
                </span>
                <span>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--fs-md)' }}>{c}</span>
                  <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{countIn(c)} products</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!filtersOn && liveCoupons.length > 0 && (
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
                  <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{c.description || `${c.percentOff}% off`}</p>
                  {c.maxDiscount && (
                    <p className="field__hint">Up to {currency(c.maxDiscount)} off</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!filtersOn && featured.length > 0 && (
        <section className="section">
          <div className="section__head"><h2 className="section__title">Featured</h2></div>
          <div className="grid grid--cards">
            {products.loading ? <CardSkeleton count={4} />
              : featured.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}

      {!filtersOn && bestSellers.length > 0 && (
        <section className="section">
          <div className="section__head"><h2 className="section__title">Best sellers</h2></div>
          <div className="grid grid--cards">
            {products.loading ? <CardSkeleton count={4} />
              : bestSellers.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}

      {/* --- Every product, with search, filters and sorting ------------------ */}
      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{category || 'All medicines'}</h2>
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            {products.loading ? 'Loading…' : `${number(results.length)} products available to order`}
          </span>
        </div>

        <Card className="card--pad section">
          <div className="row gap-3 wrap" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 260px' }}>
              <SearchInput value={query} onChange={setQuery} placeholder="Search by name, brand, SKU or manufacturer…" />
            </div>
            <div style={{ flex: '0 1 220px' }}>
              <Select options={SORTS} value={sort} onChange={(e) => setSort(e.target.value)} />
            </div>
            {filtersOn && <Button variant="ghost" icon="x" onClick={clearAll}>Clear</Button>}
          </div>

          <div className="row gap-2 wrap" style={{ marginTop: 'var(--sp-4)' }}>
            <Chip active={!category} onClick={() => setCategory('')} count={active.length}>All</Chip>
            {categories.map((c) => (
              <Chip key={c} active={sameCategory(category, c)} onClick={() => setCategory(sameCategory(category, c) ? '' : c)} count={countIn(c)}>
                {c}
              </Chip>
            ))}
            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 var(--sp-2)' }} />
            <Chip active={inStockOnly} onClick={() => setInStockOnly((v) => !v)}>In stock</Chip>
            <Chip active={rxOnly} onClick={() => setRxOnly((v) => !v)}>Prescription</Chip>
            <Chip active={coldOnly} onClick={() => setColdOnly((v) => !v)}>Cold chain</Chip>
          </div>
        </Card>

        {products.error && <ErrorState error={products.error} onRetry={products.reload} />}

        {!products.error && (
          <>
            <div className="grid grid--cards">
              {products.loading
                ? <CardSkeleton count={8} />
                : paged.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>

            {!products.loading && results.length === 0 && (
              <Card>
                <EmptyState
                  icon="search"
                  title={filtersOn ? 'No products match' : 'No products yet'}
                  text={filtersOn
                    ? 'Try a broader search, or clear the filters to see everything.'
                    : 'The catalogue is empty right now — check back soon.'}
                  action={filtersOn && <Button variant="secondary" onClick={clearAll}>Clear filters</Button>}
                />
              </Card>
            )}

            {!products.loading && results.length > PAGE_SIZE && (
              <Card className="section" style={{ marginTop: 'var(--sp-4)' }}>
                <Pagination
                  page={page} pageCount={pageCount} total={results.length} pageSize={PAGE_SIZE}
                  onPage={setPage} label="products"
                />
              </Card>
            )}
          </>
        )}
      </section>
    </>
  );
}
