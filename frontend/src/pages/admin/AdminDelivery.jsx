import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import { Card, CardHead } from '../../components/common/Card';
import FormSection from '../../components/forms/FormSection';
import { Input } from '../../components/forms/Input';
import DataTable from '../../components/tables/DataTable';
import Icon from '../../components/feedback/Icon';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { listDeliveryAgents, createDeliveryAgent } from '../../services/vendorService';
import { listAllOrders } from '../../services/orderService';
import { ORDER_STATUS } from '../../constants/orders';
import { formatDate } from '../../utils/dates';
import { number, initials } from '../../utils/format';

/**
 * Delivery agent onboarding. POST /agent-create makes the account and the
 * SERVER generates a 6-digit password, which it returns rather than emailing —
 * so the credentials are surfaced here for the admin to pass on. That is a
 * backend behaviour, not a shortcut: the app's own console documents it.
 */
export default function AdminDelivery() {
  const toast = useToast();
  const agents = useAsync(listDeliveryAgents, []);
  const orders = useAsync(listAllOrders, []);

  const [form, setForm] = useState({ name: '', mobile: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const onDuty = (orders.data || []).filter((o) => o.orderStatus === ORDER_STATUS.OUT_FOR_DELIVERY).length;
  const queued = (orders.data || []).filter((o) => o.orderStatus === ORDER_STATUS.SHIPPED).length;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setCredentials(null);
    try {
      const { agent, password } = await createDeliveryAgent(form);
      setCredentials({ mobile: agent.mobile_no, password, name: agent.contact_person_name });
      setForm({ name: '', mobile: '', email: '' });
      agents.reload();
      toast.success('Delivery agent created.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'contact_person_name',
      header: 'Agent',
      sortable: true,
      render: (a) => (
        <span className="row gap-3">
          <span className="avatar avatar--sm">{initials(a.contact_person_name)}</span>
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{a.contact_person_name}</span>
            <span className="subtle truncate" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>{a.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'mobile_no', header: 'Login id (mobile)', render: (a) => <span className="mono">{a.mobile_no}</span> },
    { key: 'city', header: 'Base', sortable: true, render: (a) => [a.city, a.pin_code].filter(Boolean).join(' · ') || '—' },
    { key: 'createdAt', header: 'Onboarded', sortable: true, render: (a) => formatDate(a.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Delivery agents"
        sub="Create agent logins and see who is on the road right now."
      />

      <div className="grid grid--kpi section">
        <StatTile label="Total agents" value={number(agents.data?.length ?? 0)} icon="truck" />
        <StatTile label="Deliveries in progress" value={number(onDuty)} icon="pin" tone="info"
          foot="Orders currently Out for Delivery" />
        <StatTile label="Waiting for pickup" value={number(queued)} icon="box" tone="warning"
          foot="Orders marked Shipped" />
      </div>

      <Note tone="warning" className="section">
        The order record has no per-agent assignment field, so every signed-in agent sees the same
        platform-wide dispatch queue. Per-agent assignment needs a backend change.
      </Note>

      <div className="split">
        <Card>
          <CardHead
            title="Registered agents"
            actions={<Button size="sm" variant="ghost" icon="refresh" onClick={agents.reload}>Refresh</Button>}
          />
          <DataTable
            columns={columns}
            rows={agents.data}
            loading={agents.loading}
            error={agents.error}
            onRetry={agents.reload}
            empty={{ icon: 'truck', title: 'No delivery agents yet', text: 'Create the first agent login using the form beside this list.' }}
          />
        </Card>

        <div className="rail">
          <form onSubmit={submit}>
            <FormSection
              icon="plus"
              title="Create agent login"
              sub="The login id is the agent's mobile number. The server generates the password."
            >
              <Input label="Full name" required placeholder="Agent's name"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="Mobile number" required inputMode="numeric" placeholder="10-digit number"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
              <Input label="Email address" required type="email" placeholder="agent@vsarogya.in"
                value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Button
                type="submit"
                variant="primary"
                block
                loading={busy}
                disabled={!form.name || form.mobile.length !== 10 || !form.email}
              >
                Create agent
              </Button>
            </FormSection>
          </form>

          {credentials && (
            <Card>
              <CardHead title="Share these credentials" sub="Shown once — the server does not email them." />
              <div className="card__body stack gap-3">
                <div className="note note--success">
                  <Icon name="check" size={15} />
                  <div>
                    <p style={{ fontWeight: 700 }}>{credentials.name} can now sign in.</p>
                    <p style={{ marginTop: 4 }}>
                      Login id <span className="mono">{credentials.mobile}</span><br />
                      Password <span className="mono" style={{ fontSize: 'var(--fs-md)', fontWeight: 800 }}>{credentials.password}</span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  icon="copy"
                  block
                  onClick={() => {
                    navigator.clipboard?.writeText(`Login: ${credentials.mobile}\nPassword: ${credentials.password}`);
                    toast.success('Credentials copied.');
                  }}
                >
                  Copy credentials
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
