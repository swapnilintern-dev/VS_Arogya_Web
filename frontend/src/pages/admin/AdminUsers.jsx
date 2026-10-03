import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Segmented from '../../components/common/Segmented';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import Pagination from '../../components/tables/Pagination';
import Note from '../../components/common/Note';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { listAllAccounts } from '../../services/vendorService';
import { normalizeRole, ROLES, ROLE_LABELS } from '../../constants/roles';
import { formatDate } from '../../utils/dates';
import { initials } from '../../utils/format';

const ROLE_TONE = {
  [ROLES.ADMIN]: 'danger',
  [ROLES.MARKETING]: 'accent',
  [ROLES.VENDOR]: 'info',
  [ROLES.DELIVERY]: 'warning',
  [ROLES.AGENT]: 'success',
};

/**
 * The platform user directory.
 *
 * Every Vendor-side account — buyers, delivery partners, area agents and staff —
 * lives in ONE Mongo collection (server/model/userModel.js) and is read from
 * GET /all-vendors, so the role filter below is the only thing separating them.
 */
export default function AdminUsers() {
  const { data, loading, error, reload } = useAsync(listAllAccounts, []);
  const [role, setRole] = useState(null);

  const scoped = useMemo(() => {
    const rows = (data || []).map((u) => ({ ...u, _role: normalizeRole(u.role) }));
    return role ? rows.filter((u) => u._role === role) : rows;
  }, [data, role]);

  const table = useTableControls(scoped, {
    searchKeys: ['store_name', 'contact_person_name', 'mobile_no', 'email', 'city'],
    initialSort: { key: 'createdAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = (data || []).map((u) => normalizeRole(u.role));
    return Object.values(ROLES).reduce(
      (acc, r) => ({ ...acc, [r]: rows.filter((x) => x === r).length }),
      { all: rows.length },
    );
  }, [data]);

  const columns = [
    {
      key: (u) => u.store_name || u.contact_person_name,
      header: 'Account',
      sortable: true,
      render: (u) => (
        <span className="row gap-3">
          <span className="avatar avatar--sm">{initials(u.store_name || u.contact_person_name)}</span>
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>
              {u.store_name || u.contact_person_name}
            </span>
            <span className="subtle truncate" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: '_role', header: 'Role', sortable: true, render: (u) => <Badge tone={ROLE_TONE[u._role]}>{ROLE_LABELS[u._role]}</Badge> },
    { key: 'mobile_no', header: 'Mobile', render: (u) => <span className="mono">{u.mobile_no}</span> },
    { key: 'city', header: 'Location', sortable: true, render: (u) => `${u.city || '—'}${u.pin_code ? ` · ${u.pin_code}` : ''}` },
    {
      key: 'approvalStatus',
      header: 'Status',
      sortable: true,
      render: (u) => (
        <Badge tone={u.approvalStatus === 'Approved' ? 'success' : u.approvalStatus === 'Rejected' ? 'danger' : 'warning'} dot>
          {u.approvalStatus || 'Approved'}
        </Badge>
      ),
    },
    { key: 'createdAt', header: 'Joined', sortable: true, render: (u) => <span className="subtle nowrap">{formatDate(u.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (u) => (u._role === ROLES.VENDOR
        ? <Button size="sm" variant="secondary" to={`/admin/vendors/${u._id}`}>Open</Button>
        : null),
    },
  ];

  return (
    <>
      <PageHeader
        title="User management"
        sub="Every account on the platform, across all roles."
        actions={(
          <>
            <Button icon="trash" to="/admin/deletion-requests">Deletion requests</Button>
            <Button variant="primary" icon="truck" to="/admin/delivery">Create delivery agent</Button>
          </>
        )}
      />

      <Note tone="info" className="section">
        Buyers, delivery partners, area agents and staff all share one collection on the backend —
        the role field is what distinguishes them. Outlets are separate and live in their own collection.
      </Note>

      <div className="section">
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { key: null, label: 'All', count: counts.all },
            { key: ROLES.VENDOR, label: 'Vendors', count: counts[ROLES.VENDOR] },
            { key: ROLES.DELIVERY, label: 'Delivery', count: counts[ROLES.DELIVERY] },
            { key: ROLES.AGENT, label: 'Area agents', count: counts[ROLES.AGENT] },
            { key: ROLES.MARKETING, label: 'Marketing', count: counts[ROLES.MARKETING] },
            { key: ROLES.ADMIN, label: 'Admin', count: counts[ROLES.ADMIN] },
          ]}
        />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search by name, mobile, email or city…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort}
          empty={{ icon: 'users', title: 'No accounts match', text: 'Try a different role filter or clear the search.' }}
        />
        <Pagination
          page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize}
          onPage={table.setPage} onPageSize={table.setPageSize} label="accounts"
        />
      </Card>
    </>
  );
}
