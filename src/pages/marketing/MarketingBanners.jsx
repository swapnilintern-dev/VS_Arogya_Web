import { useRef, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Note from '../../components/common/Note';
import { Input, Select } from '../../components/forms/Input';
import FileField from '../../components/forms/FileField';
import Icon from '../../components/feedback/Icon';
import EmptyState from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import ErrorState from '../../components/feedback/ErrorState';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { listBanners, createBanner, deleteBanner } from '../../services/couponService';
import { MEDICINE_CATEGORIES } from '../../constants/catalog';
import { formatDate } from '../../utils/dates';

/**
 * Promo banners for the vendor home carousel.
 *
 * Banners are IMAGE-FIRST: the uploaded creative renders edge-to-edge. The
 * colour/text fields are a fallback the app still honours for older,
 * image-less banners, which is why the form keeps them.
 */
const EMPTY = { tag: 'OFFER', title: '', ctaLabel: 'Shop now', startColor: '#4CAF82', endColor: '#2E7D5E', categoryId: '' };

export default function MarketingBanners() {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const { data, loading, error, reload, setData } = useAsync(listBanners, []);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.title.trim() && !image) {
      toast.error('Add a creative or a fallback headline — a banner needs at least one.');
      return;
    }
    setBusy(true);
    try {
      const created = await createBanner(form, image);
      setData((rows) => [created, ...rows]);
      setCreating(false);
      setForm(EMPTY);
      setImage(null);
      toast.success('Banner published to the vendor home carousel.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (banner) => {
    const ok = await confirm({
      title: 'Delete this banner?',
      message: 'It disappears from the vendor home carousel immediately and its creative is removed from storage.',
      confirmLabel: 'Delete banner',
    });
    if (!ok) return;
    try {
      await deleteBanner(banner._id);
      setData((rows) => rows.filter((b) => b._id !== banner._id));
      toast.success('Banner deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      {confirmUi}
      <PageHeader
        title="Promo banners"
        sub="The carousel at the top of every vendor's home screen."
        actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Add banner</Button>}
      />

      <Note tone="info" className="section">
        Banners are image-first — the creative renders edge-to-edge. The tag, headline and gradient colours
        below are a fallback the app uses for banners with no image, so older gradient banners keep working.
      </Note>

      {loading && <div className="grid grid--3"><CardSkeleton count={3} /></div>}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (data?.length === 0 ? (
        <Card>
          <EmptyState
            icon="image"
            title="No banners"
            text="Add a creative to promote an offer, a category or a new arrival."
            action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Add banner</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid--3">
          {data.map((b) => (
            <Card key={b._id}>
              <div
                style={{
                  aspectRatio: '16 / 7',
                  background: b.image?.url
                    ? `url(${b.image.url}) center/cover`
                    : `linear-gradient(135deg, ${b.startColor}, ${b.endColor})`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: 'var(--sp-5)',
                  color: '#fff',
                  borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
                }}
              >
                {!b.image?.url && (
                  <>
                    <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', alignSelf: 'flex-start' }}>
                      {b.tag}
                    </span>
                    <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginTop: 8, lineHeight: 1.25 }}>{b.title}</p>
                    <span className="row gap-1" style={{ marginTop: 10, fontWeight: 700, fontSize: 'var(--fs-sm)' }}>
                      {b.ctaLabel} <Icon name="arrowRight" size={13} />
                    </span>
                  </>
                )}
              </div>
              <CardBody className="stack gap-3">
                <div className="between">
                  <Badge tone={b.active ? 'success' : 'muted'} dot>{b.active ? 'Live' : 'Hidden'}</Badge>
                  <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{formatDate(b.createdAt)}</span>
                </div>
                {b.categoryId && <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>Links to {b.categoryId}</span>}
                <Button variant="danger-soft" icon="trash" size="sm" block onClick={() => remove(b)}>Delete</Button>
              </CardBody>
            </Card>
          ))}
        </div>
      ))}

      {creating && (
        <Modal
          title="Add promo banner"
          sub="Appears at the top of the vendor home screen"
          size="lg"
          onClose={() => setCreating(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
              <Button variant="primary" icon="check" loading={busy} onClick={save}>Publish banner</Button>
            </>
          )}
        >
          <div className="stack gap-4">
            <FileField
              label="Banner creative"
              accept="image/*"
              subtitle="Recommended 16:7 — renders edge-to-edge"
              value={image}
              onChange={setImage}
            />
            <div className="form-grid">
              <Input label="Tag" placeholder="e.g. BULK OFFER" value={form.tag} onChange={set('tag')}
                hint="Fallback only — used when there is no image" />
              <Input label="CTA label" placeholder="e.g. Shop now" value={form.ctaLabel} onChange={set('ctaLabel')} />
              <Input className="span-2" label="Headline" placeholder="e.g. Flat 20% OFF on orders above ₹10,000"
                value={form.title} onChange={set('title')} hint="Fallback only" />
              <Input label="Gradient start" type="color" value={form.startColor} onChange={set('startColor')} />
              <Input label="Gradient end" type="color" value={form.endColor} onChange={set('endColor')} />
              <Select className="span-2" label="Link to category" placeholder="No link"
                options={MEDICINE_CATEGORIES} value={form.categoryId} onChange={set('categoryId')}
                hint="Tapping the banner opens this category in the vendor catalogue" />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
