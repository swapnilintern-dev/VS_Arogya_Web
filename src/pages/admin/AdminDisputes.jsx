import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import Drawer from '../../components/common/Drawer';
import KeyValue from '../../components/common/KeyValue';
import DataTable from '../../components/tables/DataTable';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { listDisputes, resolveDispute } from '../../services/supportService';
import { currency } from '../../utils/format';
import { timeAgo, formatDateTime } from '../../utils/dates';

const TONE = { open: 'danger', 'awaiting-vendor': 'warning', resolved: 'success', refunded: 'info' };

/**
 * Dispute resolution.
 *
 * NO BACKEND ENDPOINT EXISTS for disputes — they are a Flutter-only screen with
 * no model and no route (analysis §9.4). The UI is complete so it can be wired
 * the day the server gains a dispute collection, and the banner below says so
 * plainly rather than implying the data is live.
 */
export default function AdminDisputes() {
  const { data, loading, error, reload, setData } = useAsync(listDisputes, []);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const act = async (resolution) => {
    setBusy(true);
    try {
      const updated = await resolveDispute(open._id, resolution);
      setData((rows) => rows.map((d) => (d._id === updated._id ? updated : d)));
      setOpen(updated);
      toast.success(resolution === 'refunded' ? 'Buyer refunded.' : 'Dispute resolved.');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'orderId', header: 'Order', render: (d) => <span className="mono" style={{ fontWeight: 700 }}>{d.orderId}</span> },
    {
      key: 'reason',
      header: 'Reason',
      render: (d) => (
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600 }}>{d.reason}</span>
          <span className="subtle truncate" style={{ display: 'block', fontSize: 'var(--fs-xs)', maxWidth: 380 }}>{d.detail}</span>
        </span>
      ),
    },
    { key: 'buyer', header: 'Buyer' },
    { key: 'amount', header: 'Order value', align: 'right', render: (d) => currency(d.amount) },
    { key: 'status', header: 'Status', render: (d) => <Badge tone={TONE[d.status]} dot>{d.status.replace('-', ' ')}</Badge> },
    { key: 'openedAt', header: 'Opened', render: (d) => <span className="subtle nowrap">{timeAgo(d.openedAt)}</span> },
    { key: 'actions', header: '', align: 'actions', render: (d) => <Button size="sm" variant="secondary" onClick={() => setOpen(d)}>Open</Button> },
  ];

  return (
    <>
      <PageHeader title="Disputes" sub="Buyer-raised issues on delivered or in-flight orders." />

      <Note tone="warning" className="section">
        <strong>No backend endpoint yet.</strong> The existing server has no dispute model or route —
        this screen exists in the Flutter app as UI only. Everything below is representative data so the
        workflow can be reviewed and wired up when the API lands.
      </Note>

      <Card>
        <CardHead title="Open cases" actions={<Button size="sm" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>} />
        <DataTable
          columns={columns} rows={data} loading={loading} error={error} onRetry={reload}
          onRowClick={setOpen}
          empty={{ icon: 'check', title: 'No disputes', text: 'Nothing has been escalated.' }}
        />
      </Card>

      {open && (
        <Drawer
          title={open.reason}
          sub={`${open.orderId} · ${open.buyer}`}
          onClose={() => setOpen(null)}
          footer={open.status === 'resolved' || open.status === 'refunded' ? (
            <Badge tone="success" dot>Closed</Badge>
          ) : (
            <>
              <Button variant="secondary" loading={busy} onClick={() => act('refunded')}>Refund buyer</Button>
              <Button variant="primary" icon="check" loading={busy} onClick={() => act('resolved')}>Mark resolved</Button>
            </>
          )}
        >
          <div className="stack gap-5">
            <Note tone="danger">{open.detail}</Note>

            <KeyValue rows={[
              { label: 'Order', value: <span className="mono">{open.orderId}</span> },
              { label: 'Order value', value: currency(open.amount) },
              { label: 'Buyer', value: open.buyer },
              { label: 'Supplier', value: open.vendor },
              { label: 'Evidence attached', value: `${open.evidenceCount} file(s)` },
              { label: 'Opened', value: formatDateTime(open.openedAt) },
            ]} />

            <div>
              <p className="section__title" style={{ marginBottom: 'var(--sp-3)' }}>Conversation</p>
              <div className="stack gap-3">
                {open.messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.fromVendor ? 'flex-end' : 'flex-start',
                      maxWidth: '86%',
                      padding: 'var(--sp-3) var(--sp-4)',
                      borderRadius: 'var(--r-md)',
                      background: m.fromVendor ? 'var(--brand-100)' : 'var(--surface-sunken)',
                    }}
                  >
                    <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>{m.author}</p>
                    <p style={{ marginTop: 3 }}>{m.text}</p>
                    <p className="subtle" style={{ fontSize: 10.5, marginTop: 4 }}>{timeAgo(m.at)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}
