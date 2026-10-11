import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import FormSection from '../../components/forms/FormSection';
import { Input, Textarea } from '../../components/forms/Input';
import Field from '../../components/forms/Field';
import { useToast } from '../../context/ToastContext';
import { registerOutlet } from '../../services/outletService';

/**
 * Register a physical outlet (POST /outlet-register).
 *
 * The SERVER requires every field — it answers "Missing fields" if any one is
 * blank — which is why nothing on this form is optional. The outlet then signs
 * in with the mobile number entered here plus the password set at the bottom,
 * so both are validated hard before submitting.
 */
const EMPTY = {
  outletName: '', ownerName: '', mobileNo: '', email: '',
  address: '', city: '', state: '', pincode: '', gstNumber: '',
  password: '', confirmPassword: '',
};

export default function MarketingOutletRegister() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    const need = (k, label) => { if (!String(form[k] || '').trim()) e[k] = `${label} is required`; };
    need('outletName', 'Outlet name');
    need('ownerName', 'Owner name');
    need('mobileNo', 'Mobile number');
    if (form.mobileNo && !/^\d{10}$/.test(form.mobileNo)) e.mobileNo = 'Enter a 10-digit mobile number';
    need('email', 'Email address');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
    need('address', 'Address');
    need('city', 'City');
    need('state', 'State');
    need('pincode', 'Pincode');
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) e.pincode = 'Enter a 6-digit pincode';
    need('gstNumber', 'GST number');
    if (!form.password) e.password = 'Set a password for the outlet login';
    else if (form.password.length < 6) e.password = 'Use at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const { confirmPassword, ...payload } = form;
      await registerOutlet(payload);
      toast.success(`${form.outletName} registered — it can sign in with ${form.mobileNo}.`);
      navigate('/marketing/outlets');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageHeader
        back="/marketing/outlets"
        crumbs={[{ label: 'Outlets', to: '/marketing/outlets' }, { label: 'Register outlet' }]}
        title="Register an outlet"
        sub="Creates a physical counter with its own login, stock and billing."
        actions={<Button type="submit" variant="primary" icon="check" loading={busy}>Register outlet</Button>}
      />

      <div className="split">
        <div className="stack gap-4">
          <FormSection icon="store" title="Outlet details" sub="Every field is required by the server.">
            <div className="form-grid">
              <Input label="Outlet name" required placeholder="e.g. VS Arogya Outlet — Camp"
                value={form.outletName} onChange={set('outletName')} error={errors.outletName} />
              <Input label="Owner name" required placeholder="Who runs this counter"
                value={form.ownerName} onChange={set('ownerName')} error={errors.ownerName} />
              <Input label="Mobile number" required inputMode="numeric" placeholder="10-digit number"
                value={form.mobileNo}
                onChange={(e) => set('mobileNo')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 10) } })}
                error={errors.mobileNo} hint="This is also the outlet's login id" />
              <Input label="Email address" required type="email" placeholder="outlet@vsarogya.in"
                value={form.email} onChange={set('email')} error={errors.email} />
              <Field label="Address" required className="span-2" error={errors.address}>
                <Textarea placeholder="Shop number, street, landmark" value={form.address} onChange={set('address')} />
              </Field>
              <Input label="City" required value={form.city} onChange={set('city')} error={errors.city} />
              <Input label="State" required value={form.state} onChange={set('state')} error={errors.state} />
              <Input label="Pincode" required inputMode="numeric" placeholder="6-digit pincode"
                value={form.pincode}
                onChange={(e) => set('pincode')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 6) } })}
                error={errors.pincode} hint="Used when assigning stock by area" />
              <Input label="GST number" required placeholder="15-character GSTIN"
                value={form.gstNumber}
                onChange={(e) => set('gstNumber')({ target: { value: e.target.value.toUpperCase().slice(0, 15) } })}
                error={errors.gstNumber} />
            </div>
          </FormSection>

          <FormSection icon="shield" title="Login credentials" sub="The outlet signs in with its mobile number and this password.">
            <div className="form-grid">
              <Input label="Password" required type="password" value={form.password}
                onChange={set('password')} error={errors.password} hint="At least 6 characters" />
              <Input label="Confirm password" required type="password" value={form.confirmPassword}
                onChange={set('confirmPassword')} error={errors.confirmPassword} />
            </div>
          </FormSection>
        </div>

        <div className="rail">
          <Note tone="info">
            Outlets are <strong>not</strong> vendor accounts. They live in their own collection with a separate
            login route, hold their own batch-tracked stock, and bill walk-in customers at the counter.
          </Note>
          <Note tone="warning">
            Note the password down before submitting — the server stores it hashed and there is no way to
            recover it afterwards. It can only be reset by re-registering.
          </Note>
        </div>
      </div>
    </form>
  );
}
