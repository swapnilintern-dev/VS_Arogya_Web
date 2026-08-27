import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import Field from '../../components/forms/Field';
import { Input, Select, Textarea } from '../../components/forms/Input';
import FileField from '../../components/forms/FileField';
import Icon from '../../components/feedback/Icon';
import { registerVendor } from '../../services/authService';
import { VENDOR_TYPES, SHOP_TYPES, GST_STATUSES } from '../../constants/catalog';
import cn from '../../utils/cn';

/**
 * Vendor KYC registration — the same four steps as
 * lib/vendor_registration_screen.dart (Basic → Business → Documents → Review),
 * translated to a desktop wizard. Field names, option lists and the required/
 * optional split are taken from the Flutter form and the server's
 * POST /register-vendor multipart handler.
 */
const STEPS = ['Basic details', 'Business info', 'Documents', 'Review'];

const EMPTY = {
  vendor_type: '', shop_type: '',
  store_name: '', contact_person_name: '', mobile_no: '', email: '',
  full_address: '', city: '', state: '', pin_code: '',
  gst_status: '', gst_no: '', drug_lic_no: '', drug_lic_ex_date: '',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({ store_pic: null, drug_lic_copy: null, gst_pdf: null });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const gstRegistered = form.gst_status.startsWith('Registered');

  const validate = (which) => {
    const e = {};
    const need = (k, label) => { if (!String(form[k] || '').trim()) e[k] = `${label} is required`; };

    if (which === 0) {
      need('vendor_type', 'Vendor type');
      need('shop_type', 'Shop type');
      need('store_name', 'Store / clinic name');
      need('contact_person_name', 'Contact person name');
      need('mobile_no', 'Mobile number');
      if (form.mobile_no && !/^\d{10}$/.test(form.mobile_no)) e.mobile_no = 'Enter a 10-digit mobile number';
      need('email', 'Email address');
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
      need('full_address', 'Full address');
      need('city', 'City');
      need('state', 'State');
      need('pin_code', 'Pin code');
      if (form.pin_code && !/^\d{6}$/.test(form.pin_code)) e.pin_code = 'Enter a 6-digit pin code';
    }
    if (which === 1) {
      need('gst_status', 'GST status');
      if (gstRegistered) {
        need('gst_no', 'GSTIN');
        if (form.gst_no && form.gst_no.trim().length !== 15) e.gst_no = 'A GSTIN is 15 characters';
      }
      need('drug_lic_no', 'Drug license number');
      need('drug_lic_ex_date', 'Drug license expiry date');
    }
    if (which === 2 && !files.drug_lic_copy) {
      e.drug_lic_copy = 'The drug license copy is mandatory';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep((s) => Math.min(s + 1, 3)); };

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      await registerVendor(form, files);
      navigate('/register/success', { replace: true });
    } catch (err) {
      setSubmitError(err.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth__form auth__form--wide">
      <div className="between" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>Vendor registration</h1>
          <p className="page__sub">Step {step + 1} of 4 · {STEPS[step]}</p>
        </div>
        <Link to="/login" className="btn btn--ghost btn--sm">Back to sign in</Link>
      </div>

      <div className="steps" style={{ marginBottom: 'var(--sp-5)' }}>
        {STEPS.map((label, i) => (
          <span key={label} className="row gap-2">
            {i > 0 && <span className={cn('steps__bar', i <= step && 'steps__bar--done')} />}
            <span className={cn('steps__item', i === step && 'steps__item--on', i < step && 'steps__item--done')}>
              <span className="steps__num">{i < step ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}</span>
              <span className="steps__label">{label}</span>
            </span>
          </span>
        ))}
      </div>

      <div className="progress" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="progress__bar" style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </div>

      {submitError && <Note tone="danger" className="section">{submitError}</Note>}

      {step === 0 && (
        <div className="stack gap-5">
          <div className="form-grid">
            <Select label="Vendor type" required placeholder="Select vendor type" options={VENDOR_TYPES}
              value={form.vendor_type} onChange={set('vendor_type')} error={errors.vendor_type} />
            <Select label="Shop type" required placeholder="Select shop type" options={SHOP_TYPES}
              value={form.shop_type} onChange={set('shop_type')} error={errors.shop_type} />
            <Input label="Store / clinic name" required placeholder="Enter your store or clinic name"
              value={form.store_name} onChange={set('store_name')} error={errors.store_name} />
            <Input label="Contact person name" required placeholder="Name of the contact person"
              value={form.contact_person_name} onChange={set('contact_person_name')} error={errors.contact_person_name} />
            <Input label="Mobile (WhatsApp)" required inputMode="numeric" placeholder="10-digit number"
              value={form.mobile_no} onChange={(e) => set('mobile_no')(e.target.value.replace(/\D/g, '').slice(0, 10))}
              error={errors.mobile_no} />
            <Input label="Email address" required type="email" placeholder="name@email.com"
              value={form.email} onChange={set('email')} error={errors.email} />
            <Field label="Full address" required className="span-2" error={errors.full_address}>
              <Textarea placeholder="Street address, area, landmark" value={form.full_address} onChange={set('full_address')} />
            </Field>
            <Input label="City" required placeholder="City" value={form.city} onChange={set('city')} error={errors.city} />
            <Input label="State" required placeholder="State" value={form.state} onChange={set('state')} error={errors.state} />
            <Input label="Pin code" required inputMode="numeric" placeholder="6-digit pin code"
              value={form.pin_code} onChange={(e) => set('pin_code')(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={errors.pin_code} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="stack gap-5">
          <div className="form-grid">
            <Select label="GST status" required placeholder="Select GST status" options={GST_STATUSES}
              value={form.gst_status} onChange={set('gst_status')} error={errors.gst_status} />
            {gstRegistered && (
              <Input label="GST number (GSTIN)" required placeholder="15-character GSTIN"
                value={form.gst_no} onChange={(e) => set('gst_no')(e.target.value.toUpperCase().slice(0, 15))}
                error={errors.gst_no} />
            )}
            <Input label="Drug license number" required placeholder="License number issued by FDA"
              value={form.drug_lic_no} onChange={set('drug_lic_no')} error={errors.drug_lic_no} />
            <Input label="Drug license expiry date" required type="date"
              value={form.drug_lic_ex_date} onChange={set('drug_lic_ex_date')} error={errors.drug_lic_ex_date} />
          </div>
          <Note tone="warning">
            An expired drug license blocks approval. Renew it before applying if the date above has passed.
          </Note>
        </div>
      )}

      {step === 2 && (
        <div className="stack gap-4">
          <FileField label="Drug license copy" required accept=".pdf,.jpg,.jpeg,.png"
            subtitle="Mandatory document" error={errors.drug_lic_copy}
            value={files.drug_lic_copy} onChange={(f) => setFiles((x) => ({ ...x, drug_lic_copy: f }))} />
          <FileField label="Store photo" accept=".jpg,.jpeg,.png"
            subtitle="A clear photo of your store front"
            value={files.store_pic} onChange={(f) => setFiles((x) => ({ ...x, store_pic: f }))} />
          <FileField label="GST certificate" accept=".pdf"
            subtitle="GST registration certificate (optional)"
            value={files.gst_pdf} onChange={(f) => setFiles((x) => ({ ...x, gst_pdf: f }))} />
        </div>
      )}

      {step === 3 && (
        <div className="stack gap-4">
          <ReviewCard title="Basic details" onEdit={() => setStep(0)} rows={[
            ['Vendor type', form.vendor_type], ['Shop type', form.shop_type],
            ['Store / clinic', form.store_name], ['Contact person', form.contact_person_name],
            ['Mobile', form.mobile_no], ['Email', form.email],
            ['Address', form.full_address], ['City', form.city],
            ['State', form.state], ['Pin code', form.pin_code],
          ]} />
          <ReviewCard title="Business info" onEdit={() => setStep(1)} rows={[
            ['GST status', form.gst_status],
            ...(gstRegistered ? [['GSTIN', form.gst_no]] : []),
            ['Drug license no.', form.drug_lic_no],
            ['License expiry', form.drug_lic_ex_date],
          ]} />
          <ReviewCard title="Documents" onEdit={() => setStep(2)} rows={[
            ['Drug license copy', files.drug_lic_copy?.name || 'Not uploaded'],
            ['Store photo', files.store_pic?.name || 'Not uploaded'],
            ['GST certificate', files.gst_pdf?.name || 'Not uploaded'],
          ]} />
          <Note tone="info">
            Your application goes to the VS Arogya admin team for verification. Once approved you will
            receive your login credentials by email — you cannot sign in until then.
          </Note>
        </div>
      )}

      <div className="between" style={{ marginTop: 'var(--sp-6)' }}>
        <Button variant="ghost" icon="arrowLeft" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < 3
          ? <Button variant="primary" iconRight="arrowRight" onClick={next}>Continue</Button>
          : <Button variant="primary" icon="check" loading={busy} onClick={submit}>Submit registration</Button>}
      </div>
    </div>
  );
}

function ReviewCard({ title, rows, onEdit }) {
  return (
    <section className="card">
      <div className="card__head">
        <h3 className="card__title">{title}</h3>
        <Button size="sm" variant="ghost" icon="edit" onClick={onEdit}>Edit</Button>
      </div>
      <div className="card__body card__body--tight">
        {rows.map(([label, value]) => (
          <div className="kv" key={label}>
            <span className="kv__k">{label}</span>
            <span className="kv__v">{value || '—'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
