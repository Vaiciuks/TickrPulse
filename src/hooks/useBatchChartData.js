import { useState, useEffect, useRef } from 'react';

const MAX_RETRIES = 2;
const CHUNK_SIZE = 50;

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function is24hSymbol(s) {
  return s.endsWith('=F') || s.endsWith('-USD') || s.endsWith('=X');
}

export function useBatchChartData(symbols) {
  const [chartMap, setChartMap] = useState({});
  const [retryTick, setRetryTick] = useState(0);
  const fetchedRef = useRef(new Set());
  const retryCountRef = useRef(0);

  useEffect(() => {
    const missing = symbols.filter(s => !fetchedRef.current.has(s));
    if (missing.length === 0) return;

    // Mark as in-flight to avoid duplicate requests
    missing.forEach(s => fetchedRef.current.add(s));

    const fetchChunk = async (batch, range, interval) => {
      const params = new URLSearchParams({
        symbols: batch.join(','),
        range,
        interval,
        prepost: 'true',
      });
      const res = await fetch(`/api/charts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.charts;
    };

    const fetchAll = async () => {
      // Split: futures/crypto use 5d/15m (always have data), stocks use 1d/5m
      const stocks = missing.filter(s => !is24hSymbol(s));
      const extended = missing.filter(s => is24hSymbol(s));
      const allFailed = [];

      const batches = [
        ...chunk(stocks, CHUNK_SIZE).map(b => ({ batch: b, range: '1d', interval: '5m' })),
        ...chunk(extended, CHUNK_SIZE).map(b => ({ batch: b, range: '5d', interval: '15m' })),
      ];

      for (const { batch, range, interval } of batches) {
        try {
          const charts = await fetchChunk(batch, range, interval);
          setChartMap(prev => ({ ...prev, ...charts }));

          // Symbols missing from response OR returned with empty data should retry
          for (const s of batch) {
            const d = charts[s];
            if (!d || (Array.isArray(d) && d.length === 0)) {
              allFailed.push(s);
              delete charts[s]; // don't store empty entries
            }
          }
        } catch {
          batch.forEach(s => allFailed.push(s));
        }
      }

      if (allFailed.length > 0 && retryCountRef.current < MAX_RETRIES) {
        allFailed.forEach(s => fetchedRef.current.delete(s));
        retryCountRef.current++;
        setTimeout(() => setRetryTick(t => t + 1), 2000);
      }
    };

    fetchAll();
  }, [symbols, retryTick]);

  return { chartMap };
}
