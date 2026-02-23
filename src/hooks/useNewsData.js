import { useState, useEffect, useRef, useCallback } from "react";

const CHUNK_SIZE = 50;

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function useNewsData(symbols) {
  const [newsMap, setNewsMap] = useState({});
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    const missing = symbols.filter((s) => !fetchedRef.current.has(s));
    if (missing.length === 0) return;

    missing.forEach((s) => fetchedRef.current.add(s));

    const fetchAll = async () => {
      const chunks_ = chunk(missing, CHUNK_SIZE);
      for (const batch of chunks_) {
        try {
          const params = new URLSearchParams({ symbols: batch.join(",") });
          const res = await fetch(`/api/news?${params}`);
          if (!res.ok) continue;
          const json = await res.json();
          setNewsMap((prev) => ({ ...prev, ...json.news }));
        } catch {
          // Silently ignore — news is non-critical
        }
      }
    };

    fetchAll();
  }, [symbols]);

  const hasNews = useCallback(
    (symbol) => (newsMap[symbol]?.length || 0) > 0,
    [newsMap],
  );

  const getNews = useCallback((symbol) => newsMap[symbol] || [], [newsMap]);

  return { newsMap, hasNews, getNews };
}
