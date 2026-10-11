import { useMemo, useState } from 'react';
import { useDebounce } from './useDebounce';

/**
 * Search + sort + pagination over a client-side list.
 *
 * The site is pagination-READY in the sense the brief asks for: the control
 * surface (page size, page buttons, total count) is already here, so switching
 * to server-side paging means passing the page/limit into the service instead
 * of slicing locally.
 */
export function useTableControls(rows, {
  searchKeys = [],
  initialSort = null,
  pageSize: initialPageSize = 12,
} = {}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const debounced = useDebounce(query);

  const filtered = useMemo(() => {
    const list = rows || [];
    const q = debounced.trim().toLowerCase();
    if (!q || !searchKeys.length) return list;
    return list.filter((row) =>
      searchKeys.some((key) => {
        const value = typeof key === 'function' ? key(row) : row[key];
        return String(value ?? '').toLowerCase().includes(q);
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, debounced]);

  const sorted = useMemo(() => {
    if (!sort?.key) return filtered;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = typeof sort.key === 'function' ? sort.key(a) : a[sort.key];
      const bv = typeof sort.key === 'function' ? sort.key(b) : b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      const ad = Date.parse(av); const bd = Date.parse(bv);
      if (!Number.isNaN(ad) && !Number.isNaN(bd) && typeof av === 'string' && av.includes('-')) {
        return (ad - bd) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sort]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  const toggleSort = (key) => {
    setPage(1);
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  return {
    query,
    setQuery: (v) => { setQuery(v); setPage(1); },
    sort,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (n) => { setPageSize(n); setPage(1); },
    pageCount,
    total,
    rows: paged,
    allRows: sorted,
  };
}

export default useTableControls;
