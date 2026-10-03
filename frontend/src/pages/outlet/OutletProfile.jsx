import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import StatTile from '../../components/common/StatTile';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import Spinner from '../../components/feedback/Spinner';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { getOutletProfile, listOutletStock, listOutletOrders } from '../../services/outletService';
import { currency, number, initials } from '../../utils/format';
import { formatDate } from '../../utils/dates';

/** The outlet's own account — read-only; marketing owns these details. */
export default function OutletProfile() {
  const { outletId, signOut } = useAuth();
  const profile = useAsync(() => getOutletProfile(outletId), [outletId]);
  const stock = useAsync(() => listOutletStock(outletId), [outletId]);
  const orders = useAsync(() => listOutletOrders(outletId), [outletId]);

  const p = profile.data;
  const units = (stock.data || []).reduce((s, r) => s + r.quantity, 0);
  const value = (orders.data || []).reduce((s, o) => s + o.totalAmount, 0);

  return (
    <>
      <PageHeader title="Outlet profile" sub="This counter's registered details." />

      <div className="split">
        <div className="stack gap-4">
          <div className="grid grid--3">
            <StatTile label="Medicines held" value={number(stock.data?.length ?? 0)} icon="pill" />
            <StatTile label="Units on hand" value={number(units)} icon="box" />
            <StatTile label="Order value" value={currency(value)} icon="rupee" foot="Lifetime from this counter" />
          </div>

          <Card>
            <CardHead title="Registered details" sub="Set by the marketing team at registration" />
            <CardBody>
              {profile.loading ? <Spinner /> : (
                <KeyValue rows={[
                  { label: 'Outlet name', value: p?.outletName },
                  { label: 'Owner', value: p?.ownerName },
                  { label: 'Mobile (login id)', value: <span className="mono">{p?.mobileNo}</span> },
                  { label: 'Email', value: p?.email },
                  { label: 'Address', value: p?.address },
                  { label: 'City', value: p ? `${p.city}, ${p.state}` : '—' },
                  { label: 'Pincode', value: <span className="mono">{p?.pincode}</span> },
                  { label: 'GST number', value: <span className="mono">{p?.gstNumber || '—'}</span> },
                  { label: 'Registered', value: formatDate(p?.createdAt) },
                ]} />
              )}
            </CardBody>
          </Card>

          <Note tone="info">
            Outlets are registered by the marketing team and cannot edit their own details here. Ask them to
            update anything that has changed — including the login password, which can only be reset by
            re-registering.
          </Note>
        </div>

        <div className="rail">
          <Card>
            <CardBody className="stack gap-4">
              <div className="row gap-3">
                <span className="avatar avatar--lg">{initials(p?.outletName)}</span>
                <div style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ fontWeight: 700 }}>{p?.outletName}</p>
                  <Badge tone={p?.status === 'Active' ? 'success' : 'muted'} dot>{p?.status}</Badge>
                </div>
              </div>
              <Button variant="danger-soft" icon="logout" block onClick={signOut}>Sign out</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Shortcuts" />
            <CardBody className="stack gap-2">
              <Button variant="secondary" icon="receipt" block to="/outlet/billing">Counter billing</Button>
              <Button variant="secondary" icon="layers" block to="/outlet/stock">Stock</Button>
              <Button variant="secondary" icon="list" block to="/outlet/orders">Orders</Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
