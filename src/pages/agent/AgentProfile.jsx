import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import Spinner from '../../components/feedback/Spinner';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { getAgentProfile } from '../../services/vendorService';
import { formatDate } from '../../utils/dates';
import { initials } from '../../utils/format';
import ChangePasswordCard from '../../features/ChangePasswordCard';

/** The agent's own account, fetched live so it matches what marketing registered. */
export default function AgentProfile() {
  const { session, signOut } = useAuth();
  const { data, loading } = useAsync(() => getAgentProfile(session.id), [session.id]);

  return (
    <>
      <PageHeader title="Profile" sub="Your area agent account." />

      <div className="split">
        <Card>
          <CardHead title="Account details" sub="Registered by the marketing team" />
          <CardBody>
            {loading ? <Spinner /> : (
              <KeyValue rows={[
                { label: 'Name', value: data?.contact_person_name },
                { label: 'Mobile (login id)', value: <span className="mono">{data?.mobile_no || session?.mobile}</span> },
                { label: 'Email', value: data?.email },
                {
                  label: 'Assigned pincode',
                  value: <span className="mono" style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>
                    {data?.pin_code || session?.pincode}
                  </span>,
                },
                { label: 'Area', value: data?.city },
                { label: 'Registered', value: formatDate(data?.createdAt) },
              ]} />
            )}
          </CardBody>
        </Card>

        <div className="rail">
          <Card>
            <CardBody className="stack gap-4">
              <div className="row gap-3">
                <span className="avatar avatar--lg">{initials(data?.contact_person_name || session?.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ fontWeight: 700 }}>{data?.contact_person_name || session?.name}</p>
                  <Badge tone="success" dot>Area Agent</Badge>
                </div>
              </div>
              <Button variant="secondary" icon="grid" block to="/agent">Pincode orders</Button>
              <Button variant="danger-soft" icon="logout" block onClick={signOut}>Sign out</Button>
            </CardBody>
          </Card>

          <ChangePasswordCard />

          <Note tone="info">
            One agent, one pincode. Contact the marketing team to change your assigned area — it cannot be
            changed from here.
          </Note>
        </div>
      </div>
    </>
  );
}
