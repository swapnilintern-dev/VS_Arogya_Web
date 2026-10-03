import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Segmented from '../../components/common/Segmented';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Select } from '../../components/forms/Input';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import Pagination from '../../components/tables/Pagination';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import { listVendors } from '../../services/vendorService';
import { APPROVAL_STATUS } from '../../constants/orders';
import { formatDate, daysUntil } from '../../utils/dates';
import { initials } from '../../utils/format';

const STATUS_TONE = {
  [APPROVAL_STATUS.APPROVED]: 'success',
  [APPROVAL_STATUS.PENDING]: 'warning',
  [APPROVAL_STATUS.REJECTED]: 'danger',
};

/**
 * The marketplace vendor directory. The app's status segment tabs are kept;
 * its cards become a table, and the "registration source" filter is preserved
 * because the backend tags outlet-registered vendors distinctly
 * (registrationSource: "outlet").
 */
export default function AdminVendors() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(listVendors, []);
  const [status, setStatus] = useState(null);
  const [source, setSource] = useState('');

  const filtered = useMemo(() => {
    let rows = data || [];
    if (status) rows = rows.filter((v) => v.approvalStatus === status);
    if (source) rows = rows.filter((v) => (v.registrationSource || 'admin') === source);
    return rows;
  }, [data, status, source]);

  const table = useTableControls(filtered, {
    searchKeys: ['store_name', 'contact_person_name', 'mobile_no', 'city', 'gst_no'],
    initialSort: { key: 'createdAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = data || [];
    return {
      all: rows.length,
      [APPROVAL_STATUS.APPROVED]: rows.filter((v) => v.approvalStatus === APPROVAL_STATUS.APPROVED).length,
      [APPROVAL_STATUS.PENDING]: rows.filter((v) => v.approvalStatus === APPROVAL_STATUS.PENDING).length,
      [APPROVAL_STATUS.REJECTED]: rows.filter((v) => v.approvalStatus === APPROVAL_STATUS.REJECTED).length,
    };
  }, [data]);

  const columns = [
    {
      key: 'store_name',
      header: 'Vendor',
      sortable: true,
      render: (v) => (
        <span className="row gap-3">
          <span className="avatar avatar--sm">{initials(v.store_name)}</span>
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{v.store_name}</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{v.contact_person_name}</span>
          </span>
        </span>
      ),
    },
    { key: 'shop_type', header: 'Type', sortable: true, render: (v) => (
      <span>
        <span style={{ display: 'block' }}>{v.shop_type}</span>
        <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>{v.vendor_type}</span>
      </span>
    ) },
    { key: 'city', header: 'Location', sortable: true, render: (v) => `${v.city} · ${v.pin_code}` },
    { key: 'mobile_no', header: 'Contact', render: (v) => (
      <span>
        <span className="mono" style={{ display: 'block' }}>{v.mobile_no}</span>
        <span className="subtle truncate" style={{ fontSize: 'var(--fs-xs)', display: 'block', maxWidth: 190 }}>{v.email}</span>
      </span>
    ) },
    {
      key: 'drug_lic_ex_date',
      header: 'Drug licence',
      sortable: true,
      render: (v) => {
        const days = daysUntil(v.drug_lic_ex_date);
        return (
          <span className="row gap-2 nowrap">
            <span className="num">{formatDate(v.drug_lic_ex_date)}</span>
            {days !== null && days < 0 && <Badge tone="danger">Expired</Badge>}
            {days !== null && days >= 0 && days <= 60 && <Badge tone="warning">Renew soon</Badge>}
          </span>
        );
      },
    },
    {
      key: 'approvalStatus',
      header: 'Status',
      sortable: true,
      render: (v) => (
        <span className="row gap-2">
          <Badge tone={STATUS_TONE[v.approvalStatus]} dot>{v.approvalStatus}</Badge>
          {v.registrationSource === 'outlet' && <Badge tone="accent">By outlet</Badge>}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (v) => (
        <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/vendors/${v._id}`)}>
          {v.approvalStatus === APPROVAL_STATUS.PENDING ? 'Review' : 'Open'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Vendors"
        sub="Every pharmacy, clinic and hospital registered on the platform. A vendor cannot sign in until you approve them."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="row gap-3 wrap section">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { key: null, label: 'All', count: counts.all },
            { key: APPROVAL_STATUS.PENDING, label: 'Pending', count: counts.Pending },
            { key: APPROVAL_STATUS.APPROVED, label: 'Approved', count: counts.Approved },
            { key: APPROVAL_STATUS.REJECTED, label: 'Rejected', count: counts.Rejected },
          ]}
        />
        <Select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ width: 190 }}
          options={[
            { value: '', label: 'Any registration source' },
            { value: 'admin', label: 'Registered by admin' },
            { value: 'outlet', label: 'Registered by outlet' },
          ]}
        />
      </div>

      <Card>
        <TableToolbar
          query={table.query}
          onQuery={table.setQuery}
          placeholder="Search by store, person, mobile, city or GSTIN…"
        />
        <DataTable
          columns={columns}
          rows={table.rows}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={table.sort}
          onSort={table.toggleSort}
          onRowClick={(v) => navigate(`/admin/vendors/${v._id}`)}
          empty={{ icon: 'store', title: 'No vendors match', text: 'Adjust the filters or clear the search to see more.' }}
        />
        <Pagination
          page={table.page}
          pageCount={table.pageCount}
          total={table.total}
          pageSize={table.pageSize}
          onPage={table.setPage}
          onPageSize={table.setPageSize}
          label="vendors"
        />
      </Card>
    </>
  );
}
