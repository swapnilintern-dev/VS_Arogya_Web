import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import DataTable from '../../components/tables/DataTable';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { listDeletionRequests, actionDeletionRequest } from '../../services/supportService';
import { ROLE_LABELS } from '../../constants/roles';
import { timeAgo } from '../../utils/dates';

/**
 * Account-deletion requests (Google Play data-safety requirement).
 *
 * A Vendor or Delivery Partner raises a request in the app; the admin actions
 * it. This is a CLIENT-SIDE store in the Flutter app too — there is no route
 * for it yet (analysis §9.5). The server does expose DELETE /vendor-delete for
 * the account holder's own deletion, but nothing for an admin-reviewed queue.
 */
export default function AdminDeletionRequests() {
  const { data, loading, error, reload, setData } = useAsync(listDeletionRequests, []);
  const [confirm, confirmUi] = useConfirm();
  const toast = useToast();

  const act = async (req, action) => {
    if (action === 'approved') {
      const ok = await confirm({
        title: 'Approve account deletion?',
        message: `${req.name}'s account and its data would be removed. B2B accounts may have outstanding orders or dues — check before approving.`,
        confirmLabel: 'Approve deletion',
      });
      if (!ok) return;
    }
    try {
      const updated = await actionDeletionRequest(req._id, action);
      setData((rows) => rows.map((r) => (r._id === updated._id ? updated : r)));
      toast.success(action === 'approved' ? 'Deletion approved.' : 'Request rejected.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Account',
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
          <span className="subtle mono" style={{ fontSize: 'var(--fs-xs)' }}>{r.contact}</span>
        </span>
      ),
    },
    { key: 'kind', header: 'Role', render: (r) => <Badge tone="info">{ROLE_LABELS[r.kind] || r.kind}</Badge> },
    { key: 'reason', header: 'Reason', render: (r) => <span className="muted">{r.reason}</span> },
    { key: 'requestedAt', header: 'Requested', render: (r) => <span className="subtle nowrap">{timeAgo(r.requestedAt)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'} dot>
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'actions',
      render: (r) => (r.status === 'pending' ? (
        <span className="row gap-1" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" onClick={() => act(r, 'rejected')}>Reject</Button>
          <Button size="sm" variant="danger-soft" onClick={() => act(r, 'approved')}>Approve</Button>
        </span>
      ) : null),
    },
  ];

  return (
    <>
      {confirmUi}
      <PageHeader
        title="Account deletion requests"
        sub="Vendors and delivery partners can request deletion in-app; the admin team actions it."
      />

      <Note tone="warning" className="section">
        <strong>No backend endpoint yet.</strong> The Flutter app keeps these requests client-side with a
        TODO(backend) marker. The server has <code>DELETE /vendor-delete</code> for a user deleting their own
        account, but no admin-reviewed queue.
      </Note>

      <Card>
        <CardHead title="Requests" actions={<Button size="sm" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>} />
        <DataTable
          columns={columns} rows={data} loading={loading} error={error} onRetry={reload}
          empty={{ icon: 'check', title: 'No requests', text: 'Nobody has asked for their account to be deleted.' }}
        />
      </Card>
    </>
  );
}
