import PageHeader from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import Button from '../../components/common/Button';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import ProductCard from './ProductCard';
import useAsync from '../../hooks/useAsync';
import { listSavedProducts } from '../../services/productService';

/** Saved items (wishlist) — GET /all-saved, toggled with POST /save-prod/:id. */
export default function VendorSaved() {
  const { data, loading, error, reload } = useAsync(listSavedProducts, []);

  return (
    <>
      <PageHeader
        title="Saved items"
        sub="Products you've bookmarked for later."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      {error && <ErrorState error={error} onRetry={reload} />}

      {!error && (
        <div className="grid grid--cards">
          {loading ? <CardSkeleton count={4} /> : data?.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}

      {!loading && !error && data?.length === 0 && (
        <Card>
          <EmptyState
            icon="heart"
            title="Nothing saved yet"
            text="Tap Save for later on any product to keep it here."
            action={<Button variant="primary" to="/shop">Browse medicines</Button>}
          />
        </Card>
      )}
    </>
  );
}
