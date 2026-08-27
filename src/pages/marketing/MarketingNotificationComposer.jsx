import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Note from '../../components/common/Note';
import KeyValue from '../../components/common/KeyValue';
import FormSection from '../../components/forms/FormSection';
import { Input, Select, Textarea } from '../../components/forms/Input';
import Field from '../../components/forms/Field';
import FileField from '../../components/forms/FileField';
import useAsync from '../../hooks/useAsync';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../context/ToastContext';
import { createCampaign, getAudienceSummary } from '../../services/notificationService';
import {
  NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES, NOTIFICATION_REDIRECTS, NOTIFICATION_CATEGORY_COLOR,
} from '../../constants/catalog';
import { number } from '../../utils/format';

/**
 * Compose a push campaign. Every field maps to notificationModel.js, including
 * the server's length limits (title 120, subtitle 160, message 2000, button 40).
 */
const EMPTY = {
  title: '', subtitle: '', message: '',
  category: 'General Announcement', priority: 'Normal',
  buttonText: '', redirectScreen: '', expiryDate: '', pinned: false,
  scheduledAt: '',
};

export default function MarketingNotificationComposer() {
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const audience = useAsync(getAudienceSummary, []);

  const [form, setForm] = useState(EMPTY);
  const [banner, setBanner] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [k]: value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'A title is required';
    else if (form.title.length > 120) e.title = 'Maximum 120 characters';
    if (form.subtitle.length > 160) e.subtitle = 'Maximum 160 characters';
    if (!form.message.trim()) e.message = 'A message body is required';
    else if (form.message.length > 2000) e.message = 'Maximum 2000 characters';
    if (form.buttonText.length > 40) e.buttonText = 'Maximum 40 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (mode) => {
    if (!validate()) return;

    if (mode === 'send') {
      const ok = await confirm({
        title: 'Send this broadcast now?',
        message: `It pushes immediately to roughly ${number(audience.data?.reachableVendors ?? 0)} vendor devices and cannot be recalled.`,
        confirmLabel: 'Send to all vendors',
        tone: 'primary',
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      await createCampaign({ ...form, sendNow: mode === 'send' }, banner);
      toast.success(mode === 'send' ? 'Broadcast sent.' : mode === 'schedule' ? 'Campaign scheduled.' : 'Draft saved.');
      navigate('/marketing/notifications');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const accent = NOTIFICATION_CATEGORY_COLOR[form.category] || 'var(--brand-700)';

  return (
    <>
      {confirmUi}
      <PageHeader
        back="/marketing/notifications"
        crumbs={[{ label: 'Notifications', to: '/marketing/notifications' }, { label: 'New campaign' }]}
        title="Compose notification"
        sub="Reaches every vendor who has push enabled, and fills the in-app notification centre for everyone else."
        actions={(
          <>
            <Button loading={busy} onClick={() => submit('draft')}>Save draft</Button>
            {form.scheduledAt && <Button loading={busy} onClick={() => submit('schedule')}>Schedule</Button>}
            <Button variant="primary" icon="send" loading={busy} onClick={() => submit('send')}>Send now</Button>
          </>
        )}
      />

      <div className="split split--wide-rail">
        <div className="stack gap-4">
          <FormSection icon="bell" title="Content" sub="What the vendor sees on the lock screen and in the app.">
            <div className="form-grid">
              <Input className="span-2" label="Title" required placeholder="e.g. Insulin Glargine back in stock"
                value={form.title} onChange={set('title')} error={errors.title}
                hint={`${form.title.length}/120`} />
              <Input className="span-2" label="Subtitle" placeholder="One short supporting line"
                value={form.subtitle} onChange={set('subtitle')} error={errors.subtitle}
                hint={`${form.subtitle.length}/160`} />
              <Field className="span-2" label="Message" required error={errors.message}
                hint={`${form.message.length}/2000`}>
                <Textarea rows={5} placeholder="The full body shown when the notification is opened."
                  value={form.message} onChange={set('message')} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon="settings" title="Classification & behaviour" sub="How the notification is grouped and where tapping it goes.">
            <div className="form-grid">
              <Select label="Category" options={NOTIFICATION_CATEGORIES} value={form.category} onChange={set('category')}
                hint="Sets the accent colour and default icon" />
              <Select label="Priority" options={NOTIFICATION_PRIORITIES} value={form.priority} onChange={set('priority')} />
              <Input label="Button label" placeholder="e.g. View details"
                value={form.buttonText} onChange={set('buttonText')} error={errors.buttonText}
                hint={`${form.buttonText.length}/40`} />
              <Select
                label="Opens"
                value={form.redirectScreen}
                onChange={set('redirectScreen')}
                options={Object.entries(NOTIFICATION_REDIRECTS).map(([value, label]) => ({ value, label }))}
              />
              <Input label="Expires on" type="date" value={form.expiryDate} onChange={set('expiryDate')}
                hint="Stops showing in the notification centre after this" />
              <Input label="Schedule for" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')}
                hint="Leave blank to send now or save as a draft" />
              <Field className="span-2">
                <label className="checkline">
                  <input type="checkbox" checked={form.pinned} onChange={set('pinned')} />
                  <span>
                    <strong>Pin to the top of the notification centre</strong>
                    <span className="field__hint" style={{ display: 'block' }}>
                      Use sparingly — for recalls, outages and anything a pharmacy must not miss.
                    </span>
                  </span>
                </label>
              </Field>
            </div>
          </FormSection>

          <FormSection icon="image" title="Creative" sub="Optional banner image shown inside the notification.">
            <FileField label="Banner image" accept="image/*" subtitle="Optional — 16:9 works best"
              value={banner} onChange={setBanner} />
          </FormSection>
        </div>

        <div className="rail">
          <Card>
            <CardHead title="Preview" sub="Roughly how it lands on a vendor's device" />
            <CardBody>
              <div style={{ padding: 'var(--sp-4)', borderRadius: 'var(--r-lg)', background: accent, color: '#fff' }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', opacity: 0.75 }}>
                  {form.category}
                </p>
                <p style={{ fontSize: 'var(--fs-md)', fontWeight: 800, marginTop: 6 }}>
                  {form.title || 'Notification title'}
                </p>
                {form.subtitle && <p style={{ opacity: 0.85, fontSize: 'var(--fs-sm)', marginTop: 2 }}>{form.subtitle}</p>}
                <p style={{ marginTop: 10, fontSize: 'var(--fs-sm)', opacity: 0.92 }}>
                  {form.message || 'The message body appears here.'}
                </p>
                {form.buttonText && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,.22)', color: '#fff', marginTop: 12 }}>
                    {form.buttonText}
                  </span>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Audience" />
            <CardBody>
              <KeyValue rows={[
                { label: 'Eligible vendors', value: number(audience.data?.eligibleVendors ?? 0) },
                { label: 'Reachable by push', value: number(audience.data?.reachableVendors ?? 0) },
                { label: 'Priority', value: <Badge tone={form.priority === 'Critical' ? 'danger' : 'info'}>{form.priority}</Badge> },
              ]} />
            </CardBody>
          </Card>

          <Note tone="info">
            Vendors who turned push off still receive this in their in-app notification centre — only the
            device push is skipped. Delivery, read and open receipts come back from the devices themselves.
          </Note>
        </div>
      </div>
    </>
  );
}
