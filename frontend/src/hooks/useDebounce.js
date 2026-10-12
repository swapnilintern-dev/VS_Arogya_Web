import { useEffect, useState } from 'react';

/** Debounced mirror of a value — used by every search field. */
export function useDebounce(value, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default useDebounce;
