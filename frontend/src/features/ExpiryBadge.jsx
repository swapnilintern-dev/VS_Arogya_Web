import Badge from '../components/common/Badge';
import { expiryTierOf, EXPIRY_META, EXPIRY_TIER, expiryPhrase } from '../utils/expiry';
import { formatMonthYear } from '../utils/dates';

/**
 * The shared expiry grade. Uses the SAME four-step scale as the Flutter app
 * (lib/widgets/expiry_alert.dart), so a lot looks identical in every role and
 * on both platforms.
 */
export default function ExpiryBadge({ date, showDate = false, dense = false }) {
  const tier = expiryTierOf(date);
  if (tier === EXPIRY_TIER.UNKNOWN && !showDate) return <span className="subtle">—</span>;
  const meta = EXPIRY_META[tier];

  return (
    <span className="row gap-2 nowrap">
      {showDate && <span className="num">{formatMonthYear(date)}</span>}
      <Badge tone={meta.tone} dot>{dense ? meta.label : expiryPhrase(date)}</Badge>
    </span>
  );
}

export function ExpiryDot({ date }) {
  const meta = EXPIRY_META[expiryTierOf(date)];
  return (
    <span
      title={meta.label}
      style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block', flex: 'none' }}
    />
  );
}
