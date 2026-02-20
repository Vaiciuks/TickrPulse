import { useState, useEffect } from 'react';

const REFRESH_INTERVAL = 600_000; // 10 minutes

export function useGovContracts(active) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/gov-contracts');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (mounted) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, [active]);

  return { data, loading };
}
