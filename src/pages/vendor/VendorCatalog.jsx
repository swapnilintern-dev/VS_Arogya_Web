import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Chip from '../../components/common/Chip';
import Button from '../../components/common/Button';
import { SearchInput, Select } from '../../components/forms/Input';
import Field from '../../components/forms/Field';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import Pagination from '../../components/tables/Pagination';
import ProductCard from './ProductCard';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { listProducts } from '../../services/productService';
import { MEDICINE_CATEGORIES } from '../../constants/catalog';
import { number } from '../../utils/format';
import { stockStatusOf, STOCK_STATUS } from '../../utils/stock';

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'name', label: 'Name A–Z' },
];

/** The catalogue: filter rail on the left, product grid on the right. */
export default function VendorCatalog() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useAsync(listProducts, []);

  const [query, setQuery] = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [sort, setSort] = useState('relevance');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [rxOnly, setRxOnly] = useState(false);
  const [coldOnly, setColdOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const q = useDebounce(query, 250);

  // Keep the URL in step so a filtered catalogue is shareable and back works.
  useEffect(() => {
    const next = {};
    if (q.trim()) next.q = q.trim();
    if (category) next.category = category;
    setParams(next, { replace: true });
    setPage(1);
  }, [q, category, setParams]);

  const results = useMemo(() => {
    let rows = (data || []).filter((p) => p.active);
    const term = q.trim().toLowerCase();
    if (term) {
      rows = rows.filter((p) =>
        [p.title, p.brand, p.category, p.code, p.manufacturer]
          .some((f) => String(f || '').toLowerCase().includes(term)));
    }
    if (category) rows = rows.filter((p) => p.category === category);
    if (inStockOnly) rows = rows.filter((p) => stockStatusOf(p.stock, p.lowThreshold) !== STOCK_STATUS.OUT);
    if (rxOnly) rows = rows.filter((p) => p.prescriptionRequired);
    if (coldOnly) rows = rows.filter((p) => p.cold_stored === 'yes');

    const sorted = [...rows];
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    if (sort === 'discount') sorted.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    if (sort === 'name') sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [data, q, category, sort, inStockOnly, rxOnly, coldOnly]);

  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  const paged = results.slice((page - 1) * pageSize, page * pageSize);

  const clearAll = () => {
    setQuery(''); setCategory(''); setInStockOnly(false); setRxOnly(false); setColdOnly(false); setSort('relevance');
  };
  const filtersOn = !!(q.trim() || category || inStockOnly || rxOnly || coldOnly);

  return (
    <>
      <PageHeader
        title={category || 'Catalogue'}
        sub={loading ? 'Loading the catalogue…' : `${number(results.length)} products available to order`}
      />

      <div className="split split--left-rail">
        <div className="rail">
          <Card>
            <CardHead title="Filters" actions={filtersOn && <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>} />
            <CardBody className="stack gap-5">
              <Field label="Search">
                <SearchInput value={query} onChange={setQuery} placeholder="Name, brand, SKU…" />
              </Field>

              <Field label="Category">
                <div className="stack gap-2">
                  <Chip active={!category} onClick={() => setCategory('')} count={(data || []).filter((p) => p.active).length}>
                    All categories
                  </Chip>
                  {MEDICINE_CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      active={category === c}
                      onClick={() => setCategory(category === c ? '' : c)}
                      count={(data || []).filter((p) => p.active && p.category === c).length}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Availability & handling">
                <div className="stack gap-2">
                  <label className="checkline">
                    <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
                    <span>In stock only</span>
                  </label>
                  <label className="checkline">
                    <input type="checkbox" checked={rxOnly} onChange={(e) => setRxOnly(e.target.checked)} />
                    <span>Prescription required</span>
                  </label>
                  <label className="checkline">
                    <input type="checkbox" checked={coldOnly} onChange={(e) => setColdOnly(e.target.checked)} />
                    <span>Cold chain (2–8°C)</span>
                  </label>
                </div>
              </Field>

              <Select label="Sort by" options={SORTS} value={sort} onChange={(e) => setSort(e.target.value)} />
            </CardBody>
          </Card>
        </div>

        <div>
          {error && <ErrorState error={error} onRetry={reload} />}

          {!error && (
            <>
              <div className="grid grid--cards">
                {loading
                  ? <CardSkeleton count={8} />
                  : paged.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>

              {!loading && results.length === 0 && (
                <Card>
                  <EmptyState
                    icon="search"
                    title="No products match"
                    text="Try a broader search, or clear the filters to see the whole catalogue."
                    action={filtersOn && <Button variant="secondary" onClick={clearAll}>Clear filters</Button>}
                  />
                </Card>
              )}

              {!loading && results.length > pageSize && (
                <Card className="section" style={{ marginTop: 'var(--sp-4)' }}>
                  <Pagination
                    page={page} pageCount={pageCount} total={results.length} pageSize={pageSize}
                    onPage={setPage} label="products"
                  />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
