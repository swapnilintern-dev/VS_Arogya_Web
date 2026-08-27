import Badge from '../components/common/Badge';
import { ORDER_STATUS_TONE } from '../constants/orders';

export default function OrderStatusBadge({ status }) {
  return <Badge tone={ORDER_STATUS_TONE[status] || 'muted'} dot>{status}</Badge>;
}
