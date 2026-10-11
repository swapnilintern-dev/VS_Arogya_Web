import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import Icon from '../../components/feedback/Icon';
import DetailSkeleton from '../../components/feedback/DetailSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { getAccount, approveVendor, rejectVendor } from '../../services/vendorService';
import { APPROVAL_STATUS } from '../../constants/orders';
import { formatDate, daysUntil } from '../../utils/dates';
import { initials } from '../../utils/format';
import SendNotificationCard from '../../features/SendNotificationCard';

const STATUS_TONE = {
  [APPROVAL_STATUS.APPROVED]: 'success',
  [APPROVAL_STATUS.PENDING]: 'warning',
  [APPROVAL_STATUS.REJECTED]: 'danger',
};

/**
 * Full KYC review for one vendor. Approving calls PUT /approval-mail/:id, which
 * on the server generates the vendor's credentials and EMAILS them — so the
 * confirmation says exactly that rather than a vague "are you sure".
 */
export default function AdminVendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [busy, setBusy] = useState(null);

  const { data: vendor, loading, error, reload } = useAsync(() => getAccount(id), [id]);

  if (loading) return <DetailSkeleton back={'/admin/vendors'} crumbs={[{ label: 'Vendors', to: '/admin/vendors' }]} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!vendor) return <ErrorState error={{ message: 'This vendor no longer exists.' }} />;

  const act = async (kind) => {
    const ok = await confirm(
      kind === 'approve'
        ? {
          title: 'Approve this vendor?',
          message: `${vendor.store_name} will be able to sign in immediately, and their login credentials will be emailed to ${vendor.email}.`,
          confirmLabel: 'Approve & email credentials',
          tone: 'primary',
        }
        : {
          title: 'Reject this registration?',
          message: `${vendor.store_name} will not be able to sign in. They will need to re-apply.`,
          confirmLabel: 'Reject registration',
        },
    );
    if (!ok) return;

    setBusy(kind);
    try {
      const result = kind === 'approve' ? await approveVendor(id) : await rejectVendor(id);
      toast.success(result.message || 'Done.');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const licenceDays = daysUntil(vendor.drug_lic_ex_date);
  const docs = [
    ['Drug licence copy', vendor.drug_lic_copy, true],
    ['Store photograph', vendor.store_pic, false],
    ['GST certificate', vendor.gst_pdf, false],
  ];

  return (
    <>
      {confirmUi}
      <PageHeader
        back="/admin/vendors"
        crumbs={[{ label: 'Vendors', to: '/admin/vendors' }, { label: vendor.store_name }]}
        title={vendor.store_name}
        sub={`${vendor.vendor_type} · ${vendor.shop_type} · ${vendor.city}`}
        actions={vendor.approvalStatus === APPROVAL_STATUS.PENDING ? (
          <>
            <Button variant="danger-soft" icon="x" loading={busy === 'reject'} onClick={() => act('reject')}>
              Reject
            </Button>
            <Button variant="primary" icon="check" loading={busy === 'approve'} onClick={() => act('approve')}>
              Approve vendor
            </Button>
          </>
        ) : (
          <Badge tone={STATUS_TONE[vendor.approvalStatus]} dot>{vendor.approvalStatus}</Badge>
        )}
      />

      {licenceDays !== null && licenceDays < 0 && (
        <Note tone="danger" className="section">
          This vendor’s drug licence expired on {formatDate(vendor.drug_lic_ex_date)}. Approving an expired
          licence lets an unlicensed buyer order scheduled medicines.
        </Note>
      )}
      {vendor.registrationSource === 'outlet' && (
        <Note tone="info" className="section">
          Filed through the Outlet billing counter — the walk-in customer was registered as a pending vendor
          automatically after their bill.
        </Note>
      )}

      <div className="split">
        <div className="stack gap-4">
          <Card>
            <CardHead title="Business details" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Legal / store name', value: vendor.store_name },
                { label: 'Contact person', value: vendor.contact_person_name },
                { label: 'Vendor type', value: vendor.vendor_type },
                { label: 'Shop type', value: vendor.shop_type },
                { label: 'GST status', value: vendor.gst_status === 'yes' ? 'Registered' : 'Not registered' },
                vendor.gst_no ? { label: 'GSTIN', value: <span className="mono">{vendor.gst_no}</span> } : null,
                { label: 'Drug licence no.', value: <span className="mono">{vendor.drug_lic_no}</span> },
                { label: 'Licence expiry', value: formatDate(vendor.drug_lic_ex_date) },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Verification documents" sub="The drug licence copy is mandatory; the rest are optional." />
            <CardBody className="stack gap-2">
              {docs.map(([label, doc, required]) => {
                const present = !!doc;
                return (
                  <div className="row gap-3" key={label} style={{
                    padding: 'var(--sp-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    background: present ? 'var(--surface)' : 'var(--surface-alt)',
                  }}>
                    <span className="thumb"><Icon name={present ? 'file' : 'x'} size={15} /></span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
                      <span className="subtle truncate" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                        {doc?.fileName || (present ? 'Uploaded' : required ? 'Missing — required' : 'Not provided')}
                      </span>
                    </span>
                    {present
                      ? <Badge tone="success" dot>Uploaded</Badge>
                      : <Badge tone={required ? 'danger' : 'muted'}>{required ? 'Missing' : 'Optional'}</Badge>}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>

        <div className="rail">
          <Card>
            <CardBody className="stack gap-4">
              <div className="row gap-3">
                <span className="avatar avatar--lg">{initials(vendor.store_name)}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700 }} className="truncate">{vendor.store_name}</p>
                  <Badge tone={STATUS_TONE[vendor.approvalStatus]} dot>{vendor.approvalStatus}</Badge>
                </div>
              </div>
              <KeyValue rows={[
                { label: 'Mobile', value: <span className="mono">{vendor.mobile_no}</span> },
                { label: 'Email', value: vendor.email },
                { label: 'Address', value: vendor.full_address },
                { label: 'City / state', value: `${vendor.city}, ${vendor.state}` },
                { label: 'Pin code', value: <span className="mono">{vendor.pin_code}</span> },
                { label: 'Applied on', value: formatDate(vendor.createdAt) },
              ]} />
              <Button variant="secondary" icon="receipt" block
                onClick={() => navigate(`/admin/orders?vendor=${vendor._id}`)}>
                View this vendor’s orders
              </Button>
            </CardBody>
          </Card>

          <SendNotificationCard
            recipientId={vendor._id}
            recipientType="vendor"
            recipientName={vendor.store_name}
          />
        </div>
      </div>
    </>
  );
}
