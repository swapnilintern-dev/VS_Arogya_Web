import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async function and exposes { data, loading, error, reload }.
 *
 * Every list/detail page in the site uses this, which is why loading, empty and
 * error states are consistent everywhere. A stale response from a superseded
 * call is discarded rather than rendered.
 */
export function useAsync(fn, deps = [], { immediate = true, initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const runId = useRef(0);
  const mounted = useRef(true);

  // React StrictMode mounts, unmounts and remounts every effect in
  // development. The flag must therefore be RESET on mount, not only cleared on
  // unmount — otherwise the second mount's results are discarded as stale and
  // every page hangs on its skeleton forever.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async (...args) => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      if (mounted.current && id === runId.current) setData(result);
      return result;
    } catch (err) {
      if (mounted.current && id === runId.current) setError(err);
      return undefined;
    } finally {
      if (mounted.current && id === runId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, immediate]);

  return { data, loading, error, reload: run, setData };
}

export default useAsync;
