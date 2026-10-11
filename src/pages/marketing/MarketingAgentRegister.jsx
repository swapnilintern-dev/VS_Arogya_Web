import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import FormSection from '../../components/forms/FormSection';
import { Input } from '../../components/forms/Input';
import { useToast } from '../../context/ToastContext';
import { registerAreaAgent } from '../../services/vendorService';

/**
 * Register an area agent (POST /agent-register).
 *
 * They sign in on the NORMAL sign-in form with the mobile number entered here
 * plus the password set below — so both are validated hard before submitting.
 * The server needs name, mobile, email, pincode and password.
 */
const EMPTY = { name: '', mobileNo: '', email: '', pincode: '', password: '', confirmPassword: '' };

export default function MarketingAgentRegister() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k, transform) => (e) => {
    const raw = e.target.value;
    setForm((f) => ({ ...f, [k]: transform ? transform(raw) : raw }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!/^\d{10}$/.test(form.mobileNo)) e.mobileNo = 'Enter a 10-digit mobile number';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = 'Enter the 6-digit pincode this agent will monitor';
    if (form.password.length < 6) e.password = 'Use at least 6 characters';
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
      await registerAreaAgent(payload);
      toast.success(`${form.name} can now sign in with ${form.mobileNo}.`);
      navigate('/marketing/agents');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageHeader
        back="/marketing/agents"
        crumbs={[{ label: 'Area agents', to: '/marketing/agents' }, { label: 'Register agent' }]}
        title="Register an area agent"
        sub="One agent, one pincode. They monitor every order delivering into it."
        actions={<Button type="submit" variant="primary" icon="check" loading={busy}>Register agent</Button>}
      />

      <div className="split">
        <FormSection icon="pin" title="Agent details" sub="All fields are required by the server.">
          <div className="form-grid">
            <Input label="Full name" required placeholder="Agent's name"
              value={form.name} onChange={set('name')} error={errors.name} />
            <Input label="Mobile number" required inputMode="numeric" placeholder="10-digit number"
              value={form.mobileNo} onChange={set('mobileNo', (v) => v.replace(/\D/g, '').slice(0, 10))}
              error={errors.mobileNo} hint="Also their login id" />
            <Input label="Email address" required type="email" placeholder="agent@vsarogya.in"
              value={form.email} onChange={set('email')} error={errors.email} />
            <Input label="Assigned pincode" required inputMode="numeric" placeholder="6-digit pincode"
              value={form.pincode} onChange={set('pincode', (v) => v.replace(/\D/g, '').slice(0, 6))}
              error={errors.pincode} hint="Orders delivering here become visible to this agent" />
            <Input label="Password" required type="password"
              value={form.password} onChange={set('password')} error={errors.password} hint="At least 6 characters" />
            <Input label="Confirm password" required type="password"
              value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
          </div>
        </FormSection>

        <div className="rail">
          <Note tone="info">
            The agent signs in through the same form everyone else uses — there is no separate agent login
            page. Their account decides where they land.
          </Note>
          <Note tone="warning">
            Note the password down: the server stores it hashed and there is no reset flow for agents yet.
          </Note>
        </div>
      </div>
    </form>
  );
}
