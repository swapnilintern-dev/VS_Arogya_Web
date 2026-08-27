/** Label → value row. `rows` is [{ label, value }] with falsy entries skipped. */
export default function KeyValue({ rows }) {
  return (
    <div>
      {rows.filter(Boolean).map((r) => (
        <div className={`kv${r.total ? ' kv--total' : ''}`} key={r.label}>
          <span className="kv__k">{r.label}</span>
          <span className="kv__v">{r.value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
