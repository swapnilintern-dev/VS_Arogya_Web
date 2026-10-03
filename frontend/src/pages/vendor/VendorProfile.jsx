import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KeyValue from '../../components/common/KeyValue';
import Note from '../../components/common/Note';
import StatTile from '../../components/common/StatTile';
import Icon from '../../components/feedback/Icon';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAccount } from '../../services/vendorService';
import { listMyOrders } from '../../services/orderService';
import { deleteAccount } from '../../services/authService';
import { ORDER_STATUS } from '../../constants/orders';
import { currency, number, initials } from '../../utils/format';
import { formatDate, daysUntil } from '../../utils/dates';
import ChangePasswordCard from '../../features/ChangePasswordCard';

const LINKS = [
  ['receipt', 'My orders', 'Track and reorder', '/shop/orders'],
  ['pin', 'Addresses', 'Where orders are delivered', '/shop/addresses'],
  ['heart', 'Saved items', 'Products bookmarked for later', '/shop/saved'],
  ['bell', 'Notifications', 'Updates from the VS Arogya team', '/shop/notifications'],
  ['info', 'About VS Arogya', 'Who we are and what we supply', '/shop/about'],
];

/** The vendor's account: profile, licence status, order stats and settings. */
export default function VendorProfile() {
  const { session, signOut } = useAuth();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();

  const account = useAsync(() => getAccount(session.id), [session.id]);
  const orders = useAsync(() => listMyOrders(session.id), [session.id]);

  const list = orders.data || [];
  const spent = list
    .filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED)
    .reduce((s, o) => s + o.totalAmount, 0);
  const licenceDays = daysUntil(account.data?.drug_lic_ex_date);

  const requestDeletion = async () => {
    const ok = await confirm({
      title: 'Request account deletion?',
      message: 'Your request goes to the VS Arogya admin team for review. Outstanding orders and dues must be settled first. This cannot be undone once approved.',
      confirmLabel: 'Request deletion',
    });
    if (!ok) return;
    try {
      await deleteAccount();
      toast.success('Deletion request sent to the admin team.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      {confirmUi}
      <PageHeader title="My account" sub="Your business details and order history." />

      <div className="split">
        <div className="stack gap-4">
          <div className="grid grid--3">
            <StatTile label="Orders placed" value={number(list.length)} icon="receipt" />
            <StatTile label="Delivered" value={number(list.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED).length)} icon="check" />
            <StatTile label="Total spent" value={currency(spent)} icon="rupee" foot="Across delivered orders" />
          </div>

          {licenceDays !== null && licenceDays < 60 && (
            <Note tone={licenceDays < 0 ? 'danger' : 'warning'}>
              {licenceDays < 0
                ? `Your drug licence expired on ${formatDate(account.data.drug_lic_ex_date)}. Renew it and contact support to keep ordering scheduled medicines.`
                : `Your drug licence expires in ${licenceDays} days (${formatDate(account.data.drug_lic_ex_date)}). Renew it before then.`}
            </Note>
          )}

          <Card>
            <CardHead title="Business details" sub="As registered with VS Arogya" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Store / clinic', value: account.data?.store_name || session.name },
                { label: 'Contact person', value: account.data?.contact_person_name },
                { label: 'Vendor type', value: account.data?.vendor_type },
                { label: 'Shop type', value: account.data?.shop_type },
                { label: 'Mobile', value: <span className="mono">{account.data?.mobile_no || session.mobile}</span> },
                { label: 'Email', value: account.data?.email },
                { label: 'Address', value: account.data?.full_address },
                { label: 'City', value: account.data ? `${account.data.city}, ${account.data.state} — ${account.data.pin_code}` : '—' },
                { label: 'GSTIN', value: <span className="mono">{account.data?.gst_no || 'Not registered'}</span> },
                { label: 'Drug licence', value: <span className="mono">{account.data?.drug_lic_no}</span> },
                { label: 'Licence expiry', value: formatDate(account.data?.drug_lic_ex_date) },
              ]} />
            </CardBody>
          </Card>

          <Note tone="info">
            Business details are verified at registration and can only be changed by the VS Arogya admin team.
            Contact support if something here is wrong.
          </Note>
        </div>

        <div className="rail">
          <Card>
            <CardBody className="stack gap-4">
              <div className="row gap-3">
                <span className="avatar avatar--lg">{initials(session.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ fontWeight: 700 }}>{session.name}</p>
                  <Badge tone="success" dot>{account.data?.approvalStatus || 'Approved'}</Badge>
                </div>
              </div>
              <Button variant="danger-soft" icon="logout" block onClick={signOut}>Sign out</Button>
            </CardBody>
          </Card>

          <ChangePasswordCard />

          <Card>
            <CardHead title="Shortcuts" />
            <CardBody className="stack gap-2">
              {LINKS.map(([icon, title, sub, to]) => (
                <Button key={to} variant="secondary" icon={icon} block to={to} title={sub}>{title}</Button>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Privacy & security" />
            <CardBody className="stack gap-3">
              <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                You can request that your account and its data be deleted. The admin team reviews every
                request — outstanding orders and dues have to be settled first.
              </p>
              <Button variant="ghost" icon="trash" block onClick={requestDeletion}
                style={{ color: 'var(--danger)' }}>
                Request account deletion
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
