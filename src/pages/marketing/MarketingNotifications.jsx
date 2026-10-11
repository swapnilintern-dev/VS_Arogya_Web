import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Segmented from '../../components/common/Segmented';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Drawer from '../../components/common/Drawer';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import { Card } from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';
import TableToolbar from '../../components/tables/TableToolbar';
import useAsync from '../../hooks/useAsync';
import useTableControls from '../../hooks/useTableControls';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import {
  listCampaigns, sendCampaign, retryCampaign, duplicateCampaign, deleteCampaign, getAudienceSummary,
} from '../../services/notificationService';
import { NOTIFICATION_CATEGORY_COLOR } from '../../constants/catalog';
import { number, percent } from '../../utils/format';
import { formatDateTime, timeAgo } from '../../utils/dates';

const STATUS_TONE = { sent: 'success', draft: 'muted', scheduled: 'info', failed: 'danger', sending: 'warning' };
const PRIORITY_TONE = { Critical: 'danger', High: 'warning', Normal: 'info', Low: 'muted' };

/**
 * The marketing broadcast panel.
 *
 * The backend for this is fully built (FCM broadcast, scheduler, per-device
 * token registry, delivery receipts) and the Flutter app ships the API, models
 * and controllers for it — but no screens yet. This is that panel.
 */
export default function MarketingNotifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const { data, loading, error, reload, setData } = useAsync(listCampaigns, []);
  const audience = useAsync(getAudienceSummary, []);
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  const scoped = useMemo(
    () => (status ? (data || []).filter((c) => c.status === status) : data || []),
    [data, status],
  );

  const table = useTableControls(scoped, {
    searchKeys: ['title', 'subtitle', 'category'],
    initialSort: { key: 'createdAt', dir: 'desc' },
  });

  const counts = useMemo(() => {
    const rows = data || [];
    return rows.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] || 0) + 1 }), { all: rows.length });
  }, [data]);

  const totals = useMemo(() => {
    const sent = (data || []).filter((c) => c.status === 'sent');
    const delivered = sent.reduce((s, c) => s + c.stats.delivered, 0);
    const attempted = sent.reduce((s, c) => s + c.stats.sent, 0);
    const opened = sent.reduce((s, c) => s + c.stats.opened, 0);
    return {
      campaigns: sent.length,
      delivered,
      deliveryRate: attempted ? (delivered / attempted) * 100 : 0,
      openRate: delivered ? (opened / delivered) * 100 : 0,
    };
  }, [data]);

  const act = async (campaign, kind) => {
    if (kind === 'send') {
      const ok = await confirm({
        title: `Send "${campaign.title}"?`,
        message: `This pushes to roughly ${number(audience.data?.reachableVendors ?? 0)} reachable vendor devices. A broadcast cannot be recalled once sent.`,
        confirmLabel: 'Send now',
        tone: 'primary',
      });
      if (!ok) return;
    }
    if (kind === 'delete') {
      const ok = await confirm({
        title: `Delete "${campaign.title}"?`,
        message: 'The campaign and its delivery stats are removed. Notifications already delivered stay in vendors’ inboxes.',
        confirmLabel: 'Delete campaign',
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      if (kind === 'delete') {
        await deleteCampaign(campaign._id);
        setData((rows) => rows.filter((c) => c._id !== campaign._id));
        setOpen(null);
        toast.success('Campaign deleted.');
      } else {
        const fn = { send: sendCampaign, retry: retryCampaign, duplicate: duplicateCampaign }[kind];
        const result = await fn(campaign._id);
        if (kind === 'duplicate') {
          setData((rows) => [result, ...rows]);
          toast.success('Draft copy created.');
        } else {
          setData((rows) => rows.map((c) => (c._id === result._id ? result : c)));
          setOpen(result);
          toast.success(kind === 'send' ? 'Broadcast sent.' : 'Retry queued for the failed devices.');
        }
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Campaign',
      sortable: true,
      render: (c) => (
        <span className="row gap-3">
          <span
            style={{
              width: 4, alignSelf: 'stretch', minHeight: 32, borderRadius: 2, flex: 'none',
              background: NOTIFICATION_CATEGORY_COLOR[c.category] || 'var(--brand-500)',
            }}
          />
          <span style={{ minWidth: 0 }}>
            <span className="row gap-2">
              <span className="truncate" style={{ fontWeight: 600 }}>{c.title}</span>
              {c.pinned && <Badge tone="accent">Pinned</Badge>}
            </span>
            <span className="subtle truncate" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>{c.subtitle}</span>
          </span>
        </span>
      ),
    },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'priority', header: 'Priority', sortable: true, render: (c) => <Badge tone={PRIORITY_TONE[c.priority]}>{c.priority}</Badge> },
    {
      key: (c) => c.stats.delivered,
      header: 'Delivered',
      align: 'right',
      sortable: true,
      render: (c) => (c.status === 'sent' || c.status === 'failed'
        ? <span><strong style={{ display: 'block' }}>{number(c.stats.delivered)}</strong>
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>of {number(c.stats.tokens)}</span></span>
        : <span className="subtle">—</span>),
    },
    {
      key: (c) => c.stats.opened,
      header: 'Opened',
      align: 'right',
      sortable: true,
      render: (c) => (c.stats.delivered
        ? percent((c.stats.opened / c.stats.delivered) * 100, 0)
        : <span className="subtle">—</span>),
    },
    { key: 'status', header: 'Status', sortable: true, render: (c) => <Badge tone={STATUS_TONE[c.status]} dot>{c.status}</Badge> },
    {
      key: 'sentAt',
      header: 'Sent',
      sortable: true,
      render: (c) => (c.sentAt ? <span className="subtle nowrap">{timeAgo(c.sentAt)}</span> : <span className="subtle">—</span>),
    },
    { key: 'actions', header: '', align: 'actions', render: (c) => <Button size="sm" variant="secondary" onClick={() => setOpen(c)}>Open</Button> },
  ];

  return (
    <>
      {confirmUi}
      <PageHeader
        title="Notifications"
        sub="Push campaigns to every vendor. Delivery, open and read receipts come back from the devices."
        actions={(
          <>
            <Button icon="refresh" onClick={reload}>Refresh</Button>
            <Button variant="primary" icon="plus" to="/marketing/notifications/new">New campaign</Button>
          </>
        )}
      />

      <div className="grid grid--kpi section stagger">
        <StatTile label="Reachable vendors" value={number(audience.data?.reachableVendors ?? 0)} icon="users"
          foot={`${number(audience.data?.eligibleVendors ?? 0)} eligible · rest have push off`} />
        <StatTile label="Campaigns sent" value={number(totals.campaigns)} icon="bell" />
        <StatTile label="Delivery rate" value={percent(totals.deliveryRate, 0)} icon="check" tone="info"
          foot={`${number(totals.delivered)} notifications delivered`} />
        <StatTile label="Open rate" value={percent(totals.openRate, 0)} icon="eye" tone="accent"
          foot="Of delivered notifications" />
      </div>

      {audience.data?.pushConfigured === false && (
        <Note tone="danger" className="section">
          Push is not configured on the server — campaigns will land in vendors’ in-app notification centres
          but no device push will be sent.
        </Note>
      )}

      <div className="section">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { key: null, label: 'All', count: counts.all },
            { key: 'sent', label: 'Sent', count: counts.sent || 0 },
            { key: 'scheduled', label: 'Scheduled', count: counts.scheduled || 0 },
            { key: 'draft', label: 'Drafts', count: counts.draft || 0 },
            { key: 'failed', label: 'Failed', count: counts.failed || 0 },
          ]}
        />
      </div>

      <Card>
        <TableToolbar query={table.query} onQuery={table.setQuery} placeholder="Search campaigns…" />
        <DataTable
          columns={columns} rows={table.rows} loading={loading} error={error} onRetry={reload}
          sort={table.sort} onSort={table.toggleSort} onRowClick={setOpen}
          empty={{
            icon: 'bell',
            title: 'No campaigns',
            text: 'Compose a notification to reach every vendor on the platform.',
            action: <Button variant="primary" icon="plus" to="/marketing/notifications/new">New campaign</Button>,
          }}
        />
      </Card>

      {open && (
        <Drawer
          title={open.title}
          sub={`${open.category} · ${open.priority} priority`}
          onClose={() => setOpen(null)}
          footer={(
            <>
              <Button variant="ghost" icon="copy" loading={busy} onClick={() => act(open, 'duplicate')}>Duplicate</Button>
              {open.status === 'failed' && (
                <Button variant="secondary" icon="refresh" loading={busy} onClick={() => act(open, 'retry')}>Retry failed</Button>
              )}
              {(open.status === 'draft' || open.status === 'scheduled') && (
                <Button variant="primary" icon="send" loading={busy} onClick={() => act(open, 'send')}>Send now</Button>
              )}
              <Button variant="danger-soft" icon="trash" loading={busy} onClick={() => act(open, 'delete')} aria-label="Delete" />
            </>
          )}
        >
          <div className="stack gap-5">
            <div
              style={{
                padding: 'var(--sp-4)',
                borderRadius: 'var(--r-lg)',
                background: NOTIFICATION_CATEGORY_COLOR[open.category] || 'var(--brand-700)',
                color: '#fff',
              }}
            >
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', opacity: 0.75 }}>
                {open.category}
              </p>
              <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginTop: 6 }}>{open.title}</p>
              {open.subtitle && <p style={{ opacity: 0.85, marginTop: 2 }}>{open.subtitle}</p>}
              <p style={{ marginTop: 10, fontSize: 'var(--fs-sm)', opacity: 0.92 }}>{open.message}</p>
              {open.buttonText && (
                <span className="badge" style={{ background: 'rgba(255,255,255,.22)', color: '#fff', marginTop: 12 }}>
                  {open.buttonText}
                </span>
              )}
            </div>

            {open.lastError && <Note tone="danger">{open.lastError}</Note>}

            <div>
              <p className="section__title" style={{ marginBottom: 'var(--sp-3)' }}>Delivery</p>
              <div className="grid grid--2" style={{ gap: 'var(--sp-2)' }}>
                <StatTile label="Targeted" value={number(open.stats.targeted)} />
                <StatTile label="Devices" value={number(open.stats.tokens)} />
                <StatTile label="Sent" value={number(open.stats.sent)} />
                <StatTile label="Delivered" value={number(open.stats.delivered)} tone="info" />
                <StatTile label="Read" value={number(open.stats.read)} />
                <StatTile label="Opened" value={number(open.stats.opened)} tone="accent" />
                <StatTile label="Failed" value={number(open.stats.failed)} tone={open.stats.failed ? 'danger' : undefined} />
                <StatTile label="Retries" value={number(open.stats.retryCount)} />
              </div>
            </div>

            <KeyValue rows={[
              { label: 'Status', value: <Badge tone={STATUS_TONE[open.status]} dot>{open.status}</Badge> },
              { label: 'Audience', value: 'All vendors' },
              { label: 'Opens', value: open.redirectScreen || 'Notification detail' },
              open.scheduledAt ? { label: 'Scheduled for', value: formatDateTime(open.scheduledAt) } : null,
              open.sentAt ? { label: 'Sent at', value: formatDateTime(open.sentAt) } : null,
              { label: 'Expires', value: formatDateTime(open.expiryDate) },
              { label: 'Sender', value: open.sender?.name },
            ]} />
          </div>
        </Drawer>
      )}
    </>
  );
}
