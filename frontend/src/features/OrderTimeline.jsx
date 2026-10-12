import Icon from '../components/feedback/Icon';
import { ORDER_FLOW, ORDER_STATUS } from '../constants/orders';
import { formatDateTime } from '../utils/dates';

const COPY = {
  [ORDER_STATUS.PENDING]: 'Order placed and awaiting acceptance',
  [ORDER_STATUS.CONFIRMED]: 'Accepted — invoice generated and stock deducted',
  [ORDER_STATUS.SHIPPED]: 'Packed and handed to dispatch',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'A delivery partner is on the way',
  [ORDER_STATUS.DELIVERED]: 'Handed over to the buyer',
};

/**
 * The order lifecycle, in the backend's own vocabulary. A cancelled order
 * shows the cancellation in place of the remaining steps rather than pretending
 * the pipeline continued.
 */
export default function OrderTimeline({ order }) {
  const cancelled = order.orderStatus === ORDER_STATUS.CANCELLED;
  const currentIndex = cancelled ? 0 : ORDER_FLOW.indexOf(order.orderStatus);

  const steps = cancelled
    ? [
      { status: ORDER_STATUS.PENDING, state: 'done', at: order.createdAt },
      { status: ORDER_STATUS.CANCELLED, state: 'cancelled', at: order.updatedAt },
    ]
    : ORDER_FLOW.map((status, i) => ({
      status,
      state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo',
      at: i === 0 ? order.createdAt : status === ORDER_STATUS.DELIVERED ? order.deliveredAt : null,
    }));

  return (
    <div className="timeline">
      {steps.map((step) => (
        <div key={step.status} className={`timeline__step timeline__step--${step.state}`}>
          <div className="timeline__gutter">
            <span className="timeline__dot">
              {step.state === 'done' && <Icon name="check" size={11} strokeWidth={3} />}
              {step.state === 'cancelled' && <Icon name="x" size={11} strokeWidth={3} />}
              {step.state === 'current' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />}
            </span>
            <span className="timeline__line" />
          </div>
          <div className="timeline__body">
            <p className="timeline__title">{step.status}</p>
            <p className="timeline__meta">
              {step.status === ORDER_STATUS.CANCELLED ? 'Order cancelled — stock restored' : COPY[step.status]}
              {step.at ? ` · ${formatDateTime(step.at)}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
