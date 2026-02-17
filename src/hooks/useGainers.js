import { useState, useEffect, useCallback, useRef } from 'react';
import { REFRESH_INTERVAL } from '../utils/constants.js';

export function useGainers() {
  const [gainers, setGainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchGainers = useCallback(async (isInitial) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch('/api/gainers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGainers(data.gainers);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (isInitial) setError(err.message);
      // On refresh failure, keep existing data
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGainers(true);
    intervalRef.current = setInterval(() => fetchGainers(false), REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchGainers]);

  return { gainers, loading, error, lastUpdated };
}
