import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import Icon from '../../components/feedback/Icon';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL, API_PREFIX } from '../../config/api';
import { MEDICINE_CATEGORIES } from '../../constants/catalog';
import { ORDER_FLOW } from '../../constants/orders';
import { initials } from '../../utils/format';
import ChangePasswordCard from '../../features/ChangePasswordCard';

const OPERATIONS = [
  ['truck', 'Delivery agents', 'Create logins and see the live dispatch queue.', '/admin/delivery'],
  ['users', 'User management', 'Every account across all six roles.', '/admin/users'],
  ['trash', 'Deletion requests', 'Review in-app account deletion requests.', '/admin/deletion-requests'],
  ['alert', 'Disputes', 'Buyer-raised issues on orders.', '/admin/disputes'],
];

/**
 * Platform settings. Deliberately shows the CONFIGURATION THAT ACTUALLY EXISTS
 * — the API target, the order vocabulary, the category taxonomy, the expiry
 * policy — rather than inventing toggles the backend has no field for.
 */
export default function AdminSettings() {
  const { session, roleLabel, signOut } = useAuth();

  return (
    <>
      <PageHeader title="Settings" sub="Platform configuration and operational tools." />

      <div className="split">
        <div className="stack gap-4">
          <Card>
            <CardHead title="Platform configuration" sub="Read from the running build — the backend is the source of truth for all of it." />
            <CardBody>
              <KeyValue rows={[
                { label: 'API base URL', value: <span className="mono">{API_BASE_URL}</span> },
                { label: 'Route prefix', value: <span className="mono">{API_PREFIX}</span> },
                { label: 'Data source', value: <Badge tone="success" dot>Live backend</Badge> },
                { label: 'Session token', value: 'JWT · valid 1 day' },
                { label: 'Payment gateway', value: 'Razorpay (orders, verification, payment links)' },
                { label: 'Media storage', value: 'Cloudinary (product images, video, banners, creatives)' },
                { label: 'Push delivery', value: 'Firebase Cloud Messaging' },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Business rules" sub="Enforced by the backend; the website reflects them." />
            <CardBody className="stack gap-4">
              <div>
                <p className="field__label">Order lifecycle</p>
                <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
                  {ORDER_FLOW.map((s, i) => (
                    <span key={s} className="row gap-2">
                      {i > 0 && <Icon name="chevronRight" size={11} />}
                      <Badge tone="muted">{s}</Badge>
                    </span>
                  ))}
                </div>
                <p className="field__hint" style={{ marginTop: 6 }}>
                  Accepting an order generates its invoice and deducts stock; cancelling restores it.
                </p>
              </div>

              <div>
                <p className="field__label">Medicine categories</p>
                <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
                  {MEDICINE_CATEGORIES.map((c) => <Badge key={c} tone="info">{c}</Badge>)}
                </div>
              </div>

              <div>
                <p className="field__label">Inventory policy</p>
                <p className="field__hint" style={{ marginTop: 4 }}>
                  Stock is consumed FEFO — first expiry, first out — across a product’s batches.
                  A product’s stock is always the SUM of its lots’ available quantities, never edited directly.
                  A lot is flagged expiring at 90 days and blocked from sale once expired.
                </p>
              </div>

              <div>
                <p className="field__label">Vendor approval</p>
                <p className="field__hint" style={{ marginTop: 4 }}>
                  A buyer cannot sign in until an admin approves them; approval emails their credentials.
                  Staff roles (admin, marketing, delivery, agent, outlet) skip this gate.
                </p>
              </div>
            </CardBody>
          </Card>

          <Note tone="warning">
            <strong>Security finding.</strong> The admin routes on the existing server carry no
            authentication middleware — approve-vendor, order-status and revenue endpoints are callable
            without a token. This website guards them by role on the client, but that is not a substitute
            for a server-side guard.
          </Note>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Signed in as" />
            <CardBody className="stack gap-4">
              <div className="row gap-3">
                <span className="avatar avatar--lg">{initials(session?.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ fontWeight: 700 }}>{session?.name}</p>
                  <Badge tone="danger">{roleLabel}</Badge>
                </div>
              </div>
              <KeyValue rows={[
                { label: 'Mobile', value: <span className="mono">{session?.mobile}</span> },
                { label: 'Account id', value: <span className="mono">{session?.id}</span> },
              ]} />
              <Button variant="danger-soft" icon="logout" block onClick={signOut}>Sign out</Button>
            </CardBody>
          </Card>

          <ChangePasswordCard />

          <Card>
            <CardHead title="Operations" />
            <CardBody className="stack gap-2">
              {OPERATIONS.map(([icon, title, text, to]) => (
                <Button key={to} variant="secondary" icon={icon} block to={to} title={text}>{title}</Button>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
