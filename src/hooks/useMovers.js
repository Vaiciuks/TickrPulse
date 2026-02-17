import { useState, useEffect } from 'react';

const REFRESH_INTERVAL = 60_000; // 1 minute

export function useMovers(active, session) {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    const fetchMovers = async () => {
      try {
        const res = await fetch(`/api/movers?session=${session}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) {
          setGainers(data.gainers || []);
          setLosers(data.losers || []);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchMovers();
    const id = setInterval(fetchMovers, REFRESH_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, [active, session]);

  return { gainers, losers, loading, lastUpdated };
}
