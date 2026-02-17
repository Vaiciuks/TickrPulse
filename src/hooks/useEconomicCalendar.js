import { useState, useEffect } from 'react';

const REFRESH_INTERVAL = 300_000; // 5 minutes

export function useEconomicCalendar(active) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/economic-calendar');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) {
          setEvents(data.events || []);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    fetchEvents();
    const id = setInterval(fetchEvents, REFRESH_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, [active]);

  return { events, loading, lastUpdated };
}
