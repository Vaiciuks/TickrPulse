import { useState, useEffect } from "react";

const REFRESH_INTERVAL = 300_000; // 5 minutes

export function useShortInterest(active, symbol = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    const fetchData = async () => {
      try {
        const endpoint = symbol
          ? `/api/short-interest/${encodeURIComponent(symbol)}`
          : "/api/short-interest";
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
