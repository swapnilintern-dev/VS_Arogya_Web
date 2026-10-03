import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Tabs from '../../components/common/Tabs';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import KeyValue from '../../components/common/KeyValue';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import FormSection from '../../components/forms/FormSection';
import { Input, Select, Textarea } from '../../components/forms/Input';
import Field from '../../components/forms/Field';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import StockBadge from '../../features/StockBadge';
import ExpiryBadge from '../../features/ExpiryBadge';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { getProduct, createProduct, updateProduct } from '../../services/productService';
import { MEDICINE_CATEGORIES } from '../../constants/catalog';
import { currency, number } from '../../utils/format';
import { toInputDate } from '../../utils/dates';
import ProductMediaEditor from './ProductMediaEditor';
import BatchManager from './BatchManager';

/**
 * Add / edit a medicine.
 *
 * The app splits this across three surfaces — the Add/Edit form, the media
 * editor and the embedded batch manager. On desktop they become three tabs of
 * ONE page, which is what makes restocking a real workflow instead of a
 * navigation exercise: edit the details, drop in new images, add the batch
 * you just purchased, all without leaving the medicine.
 */
const EMPTY = {
  title: '', description: '', brand: '', manufacturer: '', marketedBy: '', code: '',
  category: '', packInfo: '', packOf: 1, cold_stored: 'no',
  price: '', mrp: '', discountPercent: 0, gstPercent: 12, hsnCode: '',
  drDisPercent: '', wholesellerPercent: '',
  lowThreshold: 10, prescriptionRequired: false, active: true,
  batch_no: '', exp_date: '', stock: '',
};

/** What the server's add/update-product routes read from the body. */
const PRODUCT_FIELDS = [
  'title', 'description', 'brand', 'manufacturer', 'marketedBy', 'code', 'category', 'packInfo',
  'packOf', 'cold_stored', 'price', 'mrp', 'discountPercent', 'gstPercent', 'hsnCode',
  // Rate cards. Stored as STRINGS on the server (productModel.js), so they are
  // sent as typed rather than coerced to numbers.
  'drDisPercent', 'wholesellerPercent',
  'lowThreshold', 'prescriptionRequired', 'active', 'badge',
];

/** What a tier actually pays, for the hint under each percentage field. */
const tierPrice = (price, percent) => {
  const base = Number(price) || 0;
  const pct = Number(percent) || 0;
  if (pct <= 0) return base;
  return Math.min(base, Math.max(0, base * (1 - pct / 100)));
};

const ratePreview = (price, percent) => {
  const pct = Number(percent) || 0;
  if (!price || pct <= 0) return 'Leave blank — this buyer pays the selling price';
  return `Pays ${currency(tierPrice(price, percent))}`;
};

export default function MarketingProductEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState('details');
  const [form, setForm] = useState(EMPTY);
  const [media, setMedia] = useState({ images: [], video: null, keepImages: [], removeVideo: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const { data: product, loading, error, reload } = useAsync(
    () => (isNew ? Promise.resolve(null) : getProduct(id)),
    [id],
  );

  useEffect(() => {
    if (!product) return;
    setForm({
      ...EMPTY,
      ...product,
      exp_date: toInputDate(product.exp_date),
      mrp: product.mrp ?? '',
      price: product.price ?? '',
    });
    setMedia((m) => ({ ...m, keepImages: product.image || [] }));
  }, [product]);

  const set = (k) => (e) => {
    const value = e?.target
      ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value)
      : e;
    setForm((f) => ({ ...f, [k]: value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Medicine name is required';
    if (!form.category) e.category = 'Category is required';
    if (!String(form.price).trim() || Number(form.price) <= 0) e.price = 'A selling price is required';
    if (form.mrp && Number(form.price) > Number(form.mrp)) e.price = 'Selling price cannot exceed MRP';
    ['drDisPercent', 'wholesellerPercent'].forEach((k) => {
      const v = String(form[k] ?? '').trim();
      if (v === '') return;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) e[k] = 'Enter a percentage between 0 and 100';
    });
    if (isNew) {
      // The server materialises the first lot at creation, so it needs these.
      if (!String(form.batch_no || '').trim()) e.batch_no = 'The first batch number is required';
      if (!form.exp_date) e.exp_date = 'The first batch needs an expiry date';
      else if (new Date(form.exp_date) < new Date(new Date().toDateString())) e.exp_date = 'Expiry cannot be in the past';
      if (media.images.length === 0) e.images = 'Add at least one product image on the Media tab';
    }
    setErrors(e);
    if (Object.keys(e).length) setTab('details');
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = Object.fromEntries(PRODUCT_FIELDS.map((k) => [k, form[k]]));
      Object.assign(payload, {
        price: Number(form.price),
        mrp: Number(form.mrp) || undefined,
        packOf: Number(form.packOf) || 1,
        gstPercent: Number(form.gstPercent) || 0,
        discountPercent: Number(form.discountPercent) || 0,
        lowThreshold: Number(form.lowThreshold) || 10,
      });
      if (isNew) {
        // Legacy single-batch create: the server turns these into the first
        // ProductBatch and mirrors stock/batch_no/exp_date from it.
        Object.assign(payload, {
          batch_no: String(form.batch_no).trim(),
          exp_date: form.exp_date,
          stock: Number(form.stock) || 0,
        });
      }
      if (isNew) {
        const created = await createProduct(payload, media);
        toast.success('Medicine created with its first batch.');
        navigate(`/marketing/products/${created._id}`, { replace: true });
      } else {
        await updateProduct(id, payload, media);
        toast.success('Medicine updated.');
        reload();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <DetailSkeleton back={'/marketing/products'} crumbs={[{ label: 'Medicines', to: '/marketing/products' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  // A stale link to a deleted SKU must not render an empty edit form.
  if (!isNew && !product) {
    return (
      <ErrorState
        error={{ message: 'This medicine is no longer in the catalogue. It may have been deleted.' }}
        title="Medicine not found"
      />
    );
  }

  return (
    <>
      <PageHeader
        back="/marketing/products"
        crumbs={[{ label: 'Medicines', to: '/marketing/products' }, { label: isNew ? 'New medicine' : product?.title }]}
        title={isNew ? 'Add medicine' : product?.title}
        sub={isNew
          ? 'Create the catalogue record. Stock comes from batches, which you add once the medicine exists.'
          : `${product?.brand} · ${product?.code}`}
        actions={(
          <>
            {!isNew && (
              <Badge tone={form.active ? 'success' : 'muted'} dot>{form.active ? 'Active' : 'Inactive'}</Badge>
            )}
            {isNew && <Button icon="file" to="/marketing/products/bulk">Bulk upload</Button>}
            <Button variant="primary" icon="check" loading={busy} onClick={save}>
              {isNew ? 'Create medicine' : 'Save changes'}
            </Button>
          </>
        )}
      />

      <div className="section">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'details', label: 'Details & pricing' },
            { key: 'media', label: 'Media', count: product?.image?.length || undefined },
            { key: 'batches', label: 'Batches' },
          ]}
        />
      </div>

      {tab === 'details' && (
        <div className="split">
          <div className="stack gap-4">
            <FormSection icon="pill" title="Basic details" sub="What the medicine is and who makes it.">
              <div className="form-grid">
                <Input className="span-2" label="Medicine name" required placeholder="e.g. Amoxicillin 500mg"
                  value={form.title} onChange={set('title')} error={errors.title} />
                <Input label="Brand" placeholder="e.g. Cipla" value={form.brand} onChange={set('brand')} />
                <Input label="SKU / product code" placeholder="e.g. VSA-1012" value={form.code} onChange={set('code')} />
                <Input label="Manufacturer" value={form.manufacturer} onChange={set('manufacturer')} />
                <Input label="Marketed by" value={form.marketedBy} onChange={set('marketedBy')} />
                <Select label="Category" required placeholder="Select a category"
                  options={form.category && !MEDICINE_CATEGORIES.includes(form.category) ? [form.category, ...MEDICINE_CATEGORIES] : MEDICINE_CATEGORIES}
                  value={form.category} onChange={set('category')} error={errors.category} />
                <Input label="Pack info" placeholder="e.g. Strip of 15 tablets" value={form.packInfo} onChange={set('packInfo')} />
                <Field label="Description" className="span-2">
                  <Textarea
                    placeholder="Composition, usage, storage guidance — shown to vendors on the product page."
                    value={form.description}
                    onChange={set('description')}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection icon="rupee" title="Pricing & tax" sub="Selling price is what the vendor pays; MRP is the printed price.">
              <div className="form-grid form-grid--3">
                <Input label="MRP" type="number" min="0" step="0.01" value={form.mrp} onChange={set('mrp')} />
                <Input label="Selling price" required type="number" min="0" step="0.01"
                  value={form.price} onChange={set('price')} error={errors.price} />
                <Input label="Discount %" type="number" min="0" max="100" value={form.discountPercent} onChange={set('discountPercent')} />
                <Input label="GST %" type="number" min="0" max="28" value={form.gstPercent} onChange={set('gstPercent')}
                  hint="Prices are GST-inclusive" />
                <Input label="HSN code" value={form.hsnCode} onChange={set('hsnCode')} />
                <Input label="Units per pack" type="number" min="1" value={form.packOf} onChange={set('packOf')} />
              </div>
            </FormSection>

            <FormSection
              icon="percent"
              title="Rate cards"
              sub="The same medicine can be priced three ways. A buyer's rate card comes from their registration — hospitals and clinics get the doctor rate, wholesale and distributor accounts the wholesale rate, everyone else the selling price."
            >
              <div className="form-grid form-grid--3">
                <Input
                  label="Doctor / clinic discount %" type="number" min="0" max="100" step="0.01"
                  value={form.drDisPercent} onChange={set('drDisPercent')}
                  error={errors.drDisPercent}
                  hint={ratePreview(form.price, form.drDisPercent)}
                />
                <Input
                  label="Wholesale discount %" type="number" min="0" max="100" step="0.01"
                  value={form.wholesellerPercent} onChange={set('wholesellerPercent')}
                  error={errors.wholesellerPercent}
                  hint={ratePreview(form.price, form.wholesellerPercent)}
                />
                <Input label="Retail price" value={form.price ? currency(form.price) : '—'} readOnly disabled
                  hint="What every other buyer pays" />
              </div>
            </FormSection>

            <FormSection icon="settings" title="Handling & visibility" sub="How this medicine behaves for vendors and outlets.">
              <div className="form-grid">
                <Input label="Reorder threshold" type="number" min="0" value={form.lowThreshold} onChange={set('lowThreshold')}
                  hint="Below this the SKU is flagged low stock" />
                <Select label="Cold chain" options={[{ value: 'no', label: 'Ambient storage' }, { value: 'yes', label: 'Cold chain (2–8°C)' }]}
                  value={form.cold_stored} onChange={set('cold_stored')} />
                <Field className="span-2">
                  <label className="checkline">
                    <input type="checkbox" checked={form.prescriptionRequired} onChange={set('prescriptionRequired')} />
                    <span>
                      <strong>Prescription required</strong>
                      <span className="field__hint" style={{ display: 'block' }}>
                        Vendors see an Rx flag on the product and at checkout.
                      </span>
                    </span>
                  </label>
                </Field>
                <Field className="span-2">
                  <label className="checkline">
                    <input type="checkbox" checked={form.active} onChange={set('active')} />
                    <span>
                      <strong>Active in the catalogue</strong>
                      <span className="field__hint" style={{ display: 'block' }}>
                        Inactive medicines stay in the system and on past orders, but vendors cannot see or order them.
                      </span>
                    </span>
                  </label>
                </Field>
              </div>
            </FormSection>
          </div>

          <div className="rail">
            {isNew && (
              <Card>
                <CardHead title="First batch" sub="Every medicine is created with its opening lot; add more on the Batches tab afterwards." />
                <CardBody className="stack gap-3">
                  <Input label="Batch number" required value={form.batch_no} onChange={set('batch_no')}
                    error={errors.batch_no} placeholder="As printed on the pack" />
                  <Input label="Expiry date" required type="date" value={form.exp_date} onChange={set('exp_date')}
                    error={errors.exp_date} />
                  <Input label="Opening stock (units)" type="number" min="0" value={form.stock} onChange={set('stock')}
                    hint="Leave 0 to receive the lot later" />
                  {errors.images && <Note tone="danger">{errors.images}</Note>}
                </CardBody>
              </Card>
            )}
            {!isNew && (
              <Card>
                <CardHead title="Live inventory" sub="Maintained by the backend from this medicine’s batches" />
                <CardBody className="stack gap-3">
                  <StockBadge stock={product?.stock} lowThreshold={product?.lowThreshold} />
                  <KeyValue rows={[
                    { label: 'FEFO front batch', value: <span className="mono">{product?.batch_no || '—'}</span> },
                    { label: 'Front lot expiry', value: <ExpiryBadge date={product?.exp_date} dense showDate /> },
                  ]} />
                  <Button variant="secondary" icon="layers" block onClick={() => setTab('batches')}>
                    Manage batches
                  </Button>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHead title="Vendor-facing preview" />
              <CardBody>
                <KeyValue rows={[
                  { label: 'Name', value: form.title || '—' },
                  { label: 'Pack', value: form.packInfo || '—' },
                  { label: 'MRP', value: form.mrp ? currency(form.mrp) : '—' },
                  { label: 'Vendor price', value: form.price ? currency(form.price) : '—' },
                  form.mrp && form.price
                    ? { label: 'Saving', value: `${Math.max(0, Math.round((1 - form.price / form.mrp) * 100))}%` }
                    : null,
                  { label: 'GST', value: `${number(form.gstPercent)}% (inclusive)` },
                  Number(form.drDisPercent) > 0
                    ? { label: 'Doctor rate', value: `${currency(tierPrice(form.price, form.drDisPercent))} · ${number(form.drDisPercent)}% off` }
                    : null,
                  Number(form.wholesellerPercent) > 0
                    ? { label: 'Wholesale rate', value: `${currency(tierPrice(form.price, form.wholesellerPercent))} · ${number(form.wholesellerPercent)}% off` }
                    : null,
                ]} />
              </CardBody>
            </Card>

            {isNew && (
              <Note tone="info">
                At least one product image is required — add it on the Media tab before saving. Every later
                purchase becomes its own lot on the Batches tab, with its own expiry and pricing.
              </Note>
            )}
          </div>
        </div>
      )}

      {tab === 'media' && (
        <ProductMediaEditor
          product={product}
          media={media}
          onChange={setMedia}
          disabled={isNew}
        />
      )}

      {tab === 'batches' && (
        isNew
          ? (
            <Note tone="info">
              Save the medicine first — batches attach to an existing product, so there is nothing to add them to yet.
            </Note>
          )
          : <BatchManager productId={id} product={product} onStockChanged={reload} />
      )}
    </>
  );
}
