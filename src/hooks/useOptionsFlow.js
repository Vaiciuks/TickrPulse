import { useState, useEffect } from "react";

const REFRESH_INTERVAL = 120_000; // 2 minutes — options data changes frequently

export function useOptionsFlow(active, symbol = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    const fetchData = async () => {
      try {
        const endpoint = symbol
          ? `/api/options-flow/${encodeURIComponent(symbol)}`
          : "/api/options-flow";
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (mounted) {
          setData(json);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [active, symbol]);

  return { data, loading, lastUpdated };
}
