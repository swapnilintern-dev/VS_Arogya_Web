import { SearchInput } from '../forms/Input';

/** Search + filters row that sits above a DataTable inside the same card. */
export default function TableToolbar({ query, onQuery, placeholder, children, right }) {
  return (
    <div className="table-toolbar">
      {onQuery && <SearchInput value={query} onChange={onQuery} placeholder={placeholder} />}
      {children}
      {right && <div className="row gap-2" style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  );
}
