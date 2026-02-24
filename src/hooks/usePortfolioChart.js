import { useState, useEffect, useRef, useMemo } from "react";

const TIMEFRAME_MAP = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1h" },
  "YTD": { range: "ytd", interval: "1d" },
  All: { range: "max", interval: "1wk" },
};

const CHUNK_SIZE = 50;

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function usePortfolioChart(holdings, timeframe) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const holdingsKey = useMemo(() => {
    return holdings
      .map((h) => `${h.symbol}:${h.shares}`)
      .sort()
      .join(",");
  }, [holdings]);

  useEffect(() => {
    if (holdings.length === 0) {
      setData([]);
      return;
    }

    const tf = TIMEFRAME_MAP[timeframe];
    if (!tf) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const sharesMap = {};
    for (const h of holdings) {
      sharesMap[h.symbol] = h.shares;
    }

    const symbols = Object.keys(sharesMap);
    const batches = chunk(symbols, CHUNK_SIZE);

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const allCharts = {};
        for (const batch of batches) {
          const params = new URLSearchParams({
            symbols: batch.join(","),
            range: tf.range,
            interval: tf.interval,
            prepost: "false",
          });
          const res = await fetch(`/api/charts?${params}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          Object.assign(allCharts, json.charts || {});
        }

        // Collect all unique timestamps and per-symbol close prices
        const allTimestamps = new Set();
        const symbolData = {};
        for (const sym of symbols) {
          const candles = allCharts[sym];
          if (!candles || candles.length === 0) continue;
          symbolData[sym] = {};
          for (const c of candles) {
            allTimestamps.add(c.time);
            symbolData[sym][c.time] = c.close;
          }
        }

        if (allTimestamps.size === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        const sortedTimes = [...allTimestamps].sort((a, b) => a - b);

        // Forward-fill: for each symbol, carry the last known close
        const lastKnown = {};
        const portfolioSeries = [];

        for (const t of sortedTimes) {
          let portfolioValue = 0;
          let hasAny = false;

          for (const sym of Object.keys(symbolData)) {
            if (symbolData[sym][t] != null) {
              lastKnown[sym] = symbolData[sym][t];
            }
            if (lastKnown[sym] != null) {
              portfolioValue += lastKnown[sym] * sharesMap[sym];
              hasAny = true;
            }
          }

          if (hasAny) {
            portfolioSeries.push({ time: t, value: portfolioValue });
          }
        }

        if (!controller.signal.aborted) {
          setData(portfolioSeries);
          setLoading(false);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [holdingsKey, timeframe]);

  return { data, loading, error };
}
