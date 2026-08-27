import cn from '../../utils/cn';

/** Underlined tab bar for in-page sections (e.g. the medicine editor). */
export default function Tabs({ tabs, value, onChange }) {
  return (
    <div
      className="row"
      style={{ gap: 'var(--sp-1)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}
      role="tablist"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn('row', 'gap-2')}
          style={{
            padding: '10px 14px',
            fontSize: 'var(--fs-base)',
            fontWeight: 600,
            color: value === t.key ? 'var(--brand-800)' : 'var(--text-muted)',
            borderBottom: `2px solid ${value === t.key ? 'var(--brand-700)' : 'transparent'}`,
            marginBottom: -1,
            whiteSpace: 'nowrap',
          }}
        >
          {t.label}
          {t.count !== undefined && <span className="segmented__badge">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
