import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import PageHeader from '../../components/common/PageHeader';
import StatTile from '../../components/common/StatTile';
import Button from '../../components/common/Button';
import { Card, CardHead, CardBody } from '../../components/common/Card';
import Spinner from '../../components/feedback/Spinner';
import useAsync from '../../hooks/useAsync';
import { listAllOrders, getTotalRevenue } from '../../services/orderService';
import { ORDER_STATUS } from '../../constants/orders';
import { currency, currencyCompact, number, percent } from '../../utils/format';

/**
 * Every figure here is derived from the SAME two live reads the app's analytics
 * screen uses: GET /total-revenue for the realised-revenue headline and
 * GET /all-orders for everything else. Nothing is fabricated.
 */
const SERIES_COLORS = ['#2E7D5E', '#4CAF82', '#8DCFB0', '#B98900', '#3B82F6', '#8E24AA'];

export default function AdminAnalytics() {
  const orders = useAsync(listAllOrders, []);
  const revenue = useAsync(getTotalRevenue, []);

  const analysis = useMemo(() => {
    const list = orders.data || [];
    const delivered = list.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED);

    // Revenue by month, last 6 months.
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('en-IN', { month: 'short' }),
        revenue: 0,
        orders: 0,
      });
    }
    list.forEach((o) => {
      const d = new Date(o.createdAt);
      const bucket = months.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (!bucket) return;
      bucket.orders += 1;
      if (o.orderStatus === ORDER_STATUS.DELIVERED) bucket.revenue += o.totalAmount;
    });

    // Orders by city.
    const cityMap = new Map();
    list.forEach((o) => {
      const city = o.shippingAddress?.city || 'Unknown';
      cityMap.set(city, (cityMap.get(city) || 0) + 1);
    });
    const byCity = [...cityMap.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Category split by revenue.
    const catMap = new Map();
    list.forEach((o) => o.orderItems.forEach((it) => {
      const c = it.product?.category || 'Other';
      catMap.set(c, (catMap.get(c) || 0) + it.orderPrice * it.quantity);
    }));
    const byCategory = [...catMap.entries()].map(([name, value]) => ({ name, value: Math.round(value) }));

    // Repeat buyers.
    const buyerMap = new Map();
    list.forEach((o) => buyerMap.set(o.user._id, (buyerMap.get(o.user._id) || 0) + 1));
    const repeat = [...buyerMap.values()].filter((n) => n > 1).length;

    return {
      totalOrders: list.length,
      delivered: delivered.length,
      deliveredRate: list.length ? (delivered.length / list.length) * 100 : 0,
      cancelled: list.filter((o) => o.orderStatus === ORDER_STATUS.CANCELLED).length,
      avgOrderValue: delivered.length ? delivered.reduce((s, o) => s + o.totalAmount, 0) / delivered.length : 0,
      buyers: buyerMap.size,
      repeat,
      repeatRate: buyerMap.size ? (repeat / buyerMap.size) * 100 : 0,
      months,
      byCity,
      byCategory,
    };
  }, [orders.data]);

  if (orders.loading) return <div className="state"><Spinner size="lg" /></div>;

  const axis = { stroke: 'var(--text-subtle)', fontSize: 11 };
  const tooltipStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    boxShadow: 'var(--shadow-card)',
    fontSize: 'var(--fs-sm)',
  };

  return (
    <>
      <PageHeader
        title="Analytics"
        sub="Computed live from the platform order feed. Revenue counts delivered orders only."
        actions={<Button icon="refresh" onClick={() => { orders.reload(); revenue.reload(); }}>Refresh</Button>}
      />

      <div className="grid grid--kpi section stagger">
        <StatTile label="Realised revenue" value={currencyCompact(revenue.data || 0)} icon="rupee"
          foot="Delivered orders only" />
        <StatTile label="Average order value" value={currency(analysis.avgOrderValue)} icon="chart"
          foot="Across delivered orders" />
        <StatTile label="Delivered rate" value={percent(analysis.deliveredRate, 0)} icon="check" tone="info"
          foot={`${number(analysis.delivered)} of ${number(analysis.totalOrders)} orders`} />
        <StatTile label="Repeat buyers" value={percent(analysis.repeatRate, 0)} icon="users" tone="accent"
          foot={`${number(analysis.repeat)} of ${number(analysis.buyers)} vendors`} />
      </div>

      <div className="grid grid--2 section">
        <Card>
          <CardHead title="Revenue trend" sub="Delivered-order value by month" />
          <CardBody style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analysis.months} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4CAF82" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4CAF82" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => currencyCompact(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#2E7D5E" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Orders by city" sub="Where demand is concentrated" />
          <CardBody style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.byCity} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="city" tickLine={false} axisLine={false} tick={axis} interval={0} angle={-18} textAnchor="end" height={52} />
                <YAxis tickLine={false} axisLine={false} tick={axis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--brand-050)' }} />
                <Bar dataKey="count" fill="#4CAF82" radius={[5, 5, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="split">
        <Card>
          <CardHead title="Order volume by month" />
          <CardBody style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.months} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--brand-050)' }} />
                <Bar dataKey="orders" fill="#2E7D5E" radius={[5, 5, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <div className="rail">
          <Card>
            <CardHead title="Revenue by category" />
            <CardBody style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analysis.byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {analysis.byCategory.map((entry, i) => (
                      <Cell key={entry.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Legend verticalAlign="bottom" height={44} wrapperStyle={{ fontSize: 'var(--fs-xs)' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
