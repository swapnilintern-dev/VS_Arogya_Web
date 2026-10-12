import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { listAreaAgents } from '../../services/vendorService';
import { formatDate } from '../../utils/dates';
import { initials } from '../../utils/format';

/**
 * Area agents. An agent is assigned ONE pincode and monitors every order
 * delivering into it — read-only, no actions on the order.
 */
export default function MarketingAgents() {
  const { data, loading, error, reload } = useAsync(listAreaAgents, []);
  const table = useTableControls(data, {
    searchKeys: ['contact_person_name', 'mobile_no', 'email', 'pin_code', 'city'],
    initialSort: { key: 'pin_code', dir: 'asc' },
  });

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
    {
      key: 'pin_code',
      header: 'Assigned pincode',
      sortable: true,
      render: (a) => <span className="mono" style={{ fontWeight: 700 }}>{a.pin_code}</span>,
    },
    { key: 'city', header: 'Area', sortable: true },
    { key: 'createdAt', header: 'Registered', sortable: true, render: (a) => <span className="subtle nowrap">{formatDate(a.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Area agents"
        sub="Each agent monitors every order delivering into their assigned pincode."
        actions={<Button variant="primary" icon="plus" to="/marketing/agents/new">Register agent</Button>}
      />

      <Note tone="info" className="section">
        Area agents are <strong>read-only monitors</strong>. They see order status and line items for their
        pincode and cannot accept, ship or cancel anything. They are stored as Vendor-collection accounts
        with role <code>agent</code> and a pincode, and sign in through the normal sign-in form.
      </Note>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by name, mobile or pincode…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          empty={{
            icon: 'pin',
            title: 'No area agents yet',
            text: 'Register an agent and assign them a pincode to monitor.',
            action: <Button variant="primary" icon="plus" to="/marketing/agents/new">Register agent</Button>,
          }}
        />
      </Card>
    </>
  );
}
