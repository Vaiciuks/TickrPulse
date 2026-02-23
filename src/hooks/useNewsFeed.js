import { useState, useEffect } from "react";

const SYMBOLS = "SPY,QQQ,DIA,IWM,NVDA,AAPL,TSLA,MSFT,AMZN,META,GOOG,AMD";
const REFRESH_INTERVAL = 120_000; // 2 minutes

function normalizeTitle(title) {
  return title.toLowerCase().trim().replace(/\s+/g, " ");
}

function mergeAndDeduplicate(marketArticles, symbolNewsMap) {
  const seen = new Set();
  const all = [];

  // Symbol news first — these have thumbnails
  for (const articles of Object.values(symbolNewsMap)) {
    for (const a of articles) {
      if (!a.title || !a.title.trim()) continue;
      const key = normalizeTitle(a.title);
      if (!seen.has(key)) {
        seen.add(key);
        all.push(a);
      }
    }
  }

  // RSS articles second — may have og:image thumbnails from server scraping
  for (const a of marketArticles) {
    if (!a.title || !a.title.trim()) continue;
    const key = normalizeTitle(a.title);
    if (!seen.has(key)) {
      seen.add(key);
      all.push({ ...a, thumbnail: a.thumbnail || null });
    }
  }

  all.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  // Filter out articles older than 3 days or with missing timestamps
  const threeDaysAgo = Math.floor(Date.now() / 1000) - 3 * 86400;
  return all.filter((a) => a.publishedAt > threeDaysAgo);
}

export function useNewsFeed(active) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    const fetchAll = async () => {
      try {
        const [marketRes, symbolRes] = await Promise.allSettled([
          fetch("/api/market-news").then((r) =>
            r.ok ? r.json() : { articles: [] },
          ),
          fetch(`/api/news?symbols=${SYMBOLS}`).then((r) =>
            r.ok ? r.json() : { news: {} },
          ),
        ]);

        const marketArticles =
          marketRes.status === "fulfilled"
            ? marketRes.value.articles || []
            : [];

        const symbolNewsMap =
          symbolRes.status === "fulfilled" ? symbolRes.value.news || {} : {};

        if (mounted) {
          setArticles(mergeAndDeduplicate(marketArticles, symbolNewsMap));
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [active]);

  return { articles, loading, lastUpdated };
}
