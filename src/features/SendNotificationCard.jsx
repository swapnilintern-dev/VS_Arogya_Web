import { useState } from 'react';
import { Card, CardHead, CardBody } from '../components/common/Card';
import Button from '../components/common/Button';
import Note from '../components/common/Note';
import Field from '../components/forms/Field';
import { Input, Select, Textarea } from '../components/forms/Input';
import { useToast } from '../context/ToastContext';
import { createUserNotification } from '../services/notificationService';

/**
 * Sends ONE notification to ONE account — POST /createNotification.
 *
 * This is the direct channel, distinct from the marketing broadcast panel:
 * the message lands in that account's notification centre only. Use it to tell
 * a single vendor something about their own order or registration.
 *
 * `type` must be one of the server's enum values (notificationModel.js); the
 * list below is transcribed from it.
 */
const TYPES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ORDER_PLACED', label: 'Order placed' },
  { value: 'ORDER_PROCESSING', label: 'Order processing' },
  { value: 'ORDER_SHIPPED', label: 'Order shipped' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'ORDER_DELIVERED', label: 'Order delivered' },
  { value: 'ORDER_CANCELLED', label: 'Order cancelled' },
  { value: 'PAYMENT_SUCCESS', label: 'Payment received' },
  { value: 'PAYMENT_FAILED', label: 'Payment failed' },
  { value: 'VENDOR_APPROVED', label: 'Vendor approved' },
  { value: 'VENDOR_REJECTED', label: 'Vendor rejected' },
];

export default function SendNotificationCard({ recipientId, recipientType = 'vendor', recipientName }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('GENERAL');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false); setTitle(''); setMessage(''); setType('GENERAL'); setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setBusy(true); setError(null);
    try {
      await createUserNotification({
        recipientId, recipientType, title: title.trim(), message: message.trim(), type,
      });
      toast.success(`Notification sent to ${recipientName || 'the account'}.`);
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHead
        title="Send a notification"
        sub={`Goes to ${recipientName || 'this account'} only — not a broadcast.`}
        actions={open
          ? <Button size="sm" variant="ghost" onClick={close}>Cancel</Button>
          : <Button size="sm" variant="secondary" icon="bell" onClick={() => setOpen(true)}>Write</Button>}
      />
      {open && (
        <CardBody>
          <form className="stack gap-4" onSubmit={submit}>
            {error && <Note tone="danger">{error}</Note>}

            <Input
              label="Title" required maxLength={120}
              placeholder="Your order has been packed"
              value={title} onChange={(e) => setTitle(e.target.value)}
            />

            <Field label="Message" required hint={`${message.length}/500`}>
              <Textarea
                rows={4} maxLength={500}
                placeholder="Write what this account needs to know."
                value={message} onChange={(e) => setMessage(e.target.value)}
              />
            </Field>

            <Select
              label="Type" options={TYPES} value={type} onChange={(e) => setType(e.target.value)}
              hint="Sets the label shown on the notification."
            />

            <Button
              type="submit" variant="primary" block icon="send" loading={busy}
              disabled={!title.trim() || !message.trim() || busy}
            >
              Send notification
            </Button>
          </form>
        </CardBody>
      )}
    </Card>
  );
}
