import { useEffect, useRef } from 'react';

export default function useAutoRefresh(fetchFn, { intervalMs = 20000, enabled = true } = {}) {
  const fetchRef = useRef(fetchFn);
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  fetchRef.current = fetchFn;

  useEffect(() => {
    if (!enabled) return undefined;

    let interval;
    const run = async () => {
      if (document.visibilityState !== 'visible' || inFlightRef.current) return;
      const now = Date.now();
      if (now - lastRunRef.current < 1000) return;
      inFlightRef.current = true;
      lastRunRef.current = now;
      try {
        await fetchRef.current();
      } catch {
        // Background refresh failures retain the last successful data.
      } finally {
        inFlightRef.current = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') run();
    };
    const onFocus = () => run();

    interval = window.setInterval(run, intervalMs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, intervalMs]);
}
