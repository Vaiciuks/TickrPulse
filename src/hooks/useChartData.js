import { useState, useEffect, useRef, useCallback } from 'react';

export function useChartData(symbol, range = '1d', interval = '5m', refreshMs = 0, prepost = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async (isInitial) => {
    if (!symbol) return;
    if (isInitial) setLoading(true);

    try {
      const params = new URLSearchParams({ range, interval, prepost: String(prepost) });
      // Bypass server cache on refresh polls to ensure fresh data
      if (!isInitial) params.set('_t', Date.now());
      const res = await fetch(`/api/chart/${encodeURIComponent(symbol)}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data);
    } catch {
      // keep existing data on refresh failure
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [symbol, range, interval, prepost]);

  useEffect(() => {
    setData(null);
    fetchData(true);

    if (refreshMs > 0) {
      intervalRef.current = setInterval(() => fetchData(false), refreshMs);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshMs]);

  return { data, loading };
}
