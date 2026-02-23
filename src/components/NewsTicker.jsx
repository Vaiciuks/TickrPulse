import { useState, useEffect, useRef } from "react";

export default function NewsTicker() {
  const [articles, setArticles] = useState([]);
  const trackRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const fetchNews = async () => {
      try {
        const res = await fetch("/api/market-news");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setArticles(data.articles || []);
      } catch {
        // silent
      }
    };

    fetchNews();
    const id = setInterval(fetchNews, 120_000); // refresh every 2 min
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (articles.length === 0) return null;

  // Duplicate articles for seamless loop
  const items = [...articles, ...articles];

  return (
    <div className="news-ticker">
      <div className="news-ticker-track" ref={trackRef}>
        {items.map((article, i) => (
          <a
            key={i}
            className="news-ticker-item"
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="news-ticker-publisher">{article.publisher}</span>
            <span className="news-ticker-title">{article.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
