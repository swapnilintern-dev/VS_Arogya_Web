import { useMemo } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import StatTile from '../../components/common/StatTile';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { getRiderProfile, listDelivered } from '../../services/deliveryService';
import { currency, number } from '../../utils/format';
import { daysUntil } from '../../utils/dates';
import { initials } from '../../utils/format';

/** The rider's own account and delivery record. */
export default function DeliveryProfile() {
  const { session, signOut } = useAuth();
  const profile = useAsync(getRiderProfile, []);
  const delivered = useAsync(listDelivered, []);

  const stats = useMemo(() => {
    const rows = delivered.data || [];
    const within = (days) => rows.filter((o) => {
      const d = -daysUntil(o.deliveredAt || o.createdAt);
      return d !== null && d <= days;
    });
    return {
      today: within(1).length,
      week: within(7).length,
      month: within(30).length,
      value: within(30).reduce((s, o) => s + o.totalAmount, 0),
    };
  }, [delivered.data]);

  const p = profile.data;

  return (
    <>
      <PageHeader title="Profile" sub="Your account and delivery record." />

      <div className="split">
        <div className="stack gap-4">
          <div className="grid grid--4">
            <StatTile label="Today" value={number(stats.today)} icon="truck" />
            <StatTile label="This week" value={number(stats.week)} icon="calendar" />
            <StatTile label="This month" value={number(stats.month)} icon="chart" tone="info" />
            <StatTile label="Value handled" value={currency(stats.value)} icon="rupee" foot="Last 30 days" />
          </div>

          <Card>
            <CardHead title="Vehicle" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Registration', value: <span className="mono">{p?.vehicle?.number}</span> },
                { label: 'Type', value: p?.vehicle?.type },
                {
                  label: 'Verification',
                  value: p?.vehicle?.verified
                    ? <Badge tone="success" dot>Verified</Badge>
                    : <Badge tone="warning" dot>Pending</Badge>,
                },
              ]} />
            </CardBody>
          </Card>

          <Note tone="info">
            Delivery accounts are created by the admin team. Your login id is your mobile number; contact
            your dispatcher if any detail here needs changing.
          </Note>
        </div>

        <div className="rail">
          <Card>
            <CardBody className="stack gap-4">
              <div className="row gap-3">
                <span className="avatar avatar--lg">{initials(p?.name || session?.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ fontWeight: 700 }}>{p?.name || session?.name}</p>
                  <Badge tone="info">{p?.role || 'Delivery Partner'}</Badge>
                </div>
              </div>
              <KeyValue rows={[
                { label: 'Mobile', value: <span className="mono">{p?.phone || session?.mobile}</span> },
                { label: 'Rating', value: p?.rating ? `${p.rating} / 5` : '—' },
                { label: 'Lifetime deliveries', value: number(p?.totalDeliveries ?? 0) },
              ]} />
              <Button variant="danger-soft" icon="logout" block onClick={signOut}>Sign out</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Shortcuts" />
            <CardBody className="stack gap-2">
              <Button variant="secondary" icon="grid" block to="/delivery">Task queue</Button>
              <Button variant="secondary" icon="receipt" block to="/delivery/history">My deliveries</Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
