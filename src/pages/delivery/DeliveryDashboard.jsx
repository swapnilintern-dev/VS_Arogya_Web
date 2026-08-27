import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Segmented from '../../components/common/Segmented';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Note from '../../components/common/Note';
import { Card, CardBody } from '../../components/common/Card';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import Icon from '../../components/feedback/Icon';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { listTasks, pickUpTask } from '../../services/deliveryService';
import { currency, number, initials } from '../../utils/format';
import { timeAgo } from '../../utils/dates';

/**
 * The rider's task queue.
 *
 * A task is an order that is Shipped (waiting for pickup) or Out for Delivery
 * (in progress). NOTE: the order record has no per-agent assignment field, so
 * this queue is shared by every signed-in agent — the app has the same
 * limitation and documents it.
 */
export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(listTasks, []);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const scoped = useMemo(() => {
    const rows = data || [];
    if (filter === 'active') return rows.filter((t) => t.taskStatus === 'active');
    if (filter === 'next') return rows.filter((t) => t.taskStatus === 'next');
    return rows;
  }, [data, filter]);

  const counts = useMemo(() => {
    const rows = data || [];
    return {
      all: rows.length,
      active: rows.filter((t) => t.taskStatus === 'active').length,
      next: rows.filter((t) => t.taskStatus === 'next').length,
      cod: rows.reduce((s, t) => s + t.codAmount, 0),
    };
  }, [data]);

  const pickUp = async (task) => {
    setBusyId(task._id);
    try {
      await pickUpTask(task._id);
      setData((rows) => rows.map((t) => (t._id === task._id ? { ...t, taskStatus: 'active', orderStatus: 'Out for Delivery' } : t)));
      toast.success(`${task.orderNo} picked up — you're on the way.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Task queue"
        sub="Orders ready for pickup and deliveries in progress."
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--kpi section">
        <StatTile label="On the road" value={number(counts.active)} icon="truck" tone="info"
          foot="Out for delivery right now" />
        <StatTile label="Ready for pickup" value={number(counts.next)} icon="box" tone="warning"
          foot="Packed and waiting" />
        <StatTile label="Cash to collect" value={currency(counts.cod)} icon="rupee"
          foot="Across COD orders in the queue" />
      </div>

      <Note tone="info" className="section">
        This queue is shared by every delivery partner — the order record has no per-agent assignment field
        yet, so pick up only what your dispatcher has given you.
      </Note>

      <div className="section">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'active', label: 'On the road', count: counts.active },
            { key: 'next', label: 'Ready for pickup', count: counts.next },
          ]}
        />
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <div className="grid grid--2"><CardSkeleton count={4} /></div>}

      {!loading && !error && scoped.length === 0 && (
        <Card>
          <EmptyState
            icon="check"
            title="Nothing in the queue"
            text="New tasks appear here as soon as orders are packed and marked shipped."
          />
        </Card>
      )}

      {!loading && !error && scoped.length > 0 && (
        <div className="grid grid--2">
          {scoped.map((task) => (
            <Card key={task._id}>
              <CardBody className="stack gap-4">
                <div className="between">
                  <span className="row gap-3">
                    <span className="avatar">{initials(task.user.store_name)}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="truncate" style={{ display: 'block', fontWeight: 700 }}>{task.user.store_name}</span>
                      <span className="mono subtle" style={{ fontSize: 'var(--fs-xs)' }}>{task.orderNo}</span>
                    </span>
                  </span>
                  <Badge tone={task.taskStatus === 'active' ? 'info' : 'warning'} dot>
                    {task.taskStatus === 'active' ? 'On the road' : 'Ready'}
                  </Badge>
                </div>

                <div className="stack gap-2">
                  <span className="row gap-3">
                    <Icon name="pin" size={15} />
                    <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                      {task.shippingAddress.address}, {task.shippingAddress.city} — {task.shippingAddress.pincode}
                    </span>
                  </span>
                  <span className="row gap-3">
                    <Icon name="phone" size={15} />
                    <a href={`tel:${task.shippingAddress.phoneNo}`} className="mono" style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand-700)' }}>
                      {task.shippingAddress.phoneNo}
                    </a>
                  </span>
                  <span className="row gap-3">
                    <Icon name="box" size={15} />
                    <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                      {task.orderItems.length} line(s) · {number(task.itemCount)} units
                    </span>
                  </span>
                </div>

                <div className="between" style={{ paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border)' }}>
                  <span>
                    <span className="subtle" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                      {task.codAmount > 0 ? 'Collect on delivery' : 'Already paid online'}
                    </span>
                    <strong style={{ fontSize: 'var(--fs-md)' }}>
                      {task.codAmount > 0 ? currency(task.codAmount) : currency(task.totalAmount)}
                    </strong>
                  </span>
                  <span className="row gap-2">
                    {task.taskStatus === 'next' ? (
                      <Button variant="primary" icon="truck" loading={busyId === task._id} onClick={() => pickUp(task)}>
                        Pick up
                      </Button>
                    ) : (
                      <Button variant="primary" iconRight="arrowRight" onClick={() => navigate(`/delivery/tasks/${task._id}`)}>
                        Complete delivery
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => navigate(`/delivery/tasks/${task._id}`)}>Open</Button>
                  </span>
                </div>

                <p className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>Packed {timeAgo(task.updatedAt || task.createdAt)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
