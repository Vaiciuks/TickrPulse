import { useNewsFeed } from '../hooks/useNewsFeed.js';

const PUBLISHER_COLORS = {
  'CNBC':          '#1d8cf8',
  'Bloomberg':     '#7c3aed',
  'MarketWatch':   '#f59e0b',
  'Reuters':       '#0ea5e9',
  'Yahoo Finance': '#6366f1',
  "Barron's":      '#ec4899',
  "Investor's Business Daily": '#10b981',
  'The Wall Street Journal':   '#f97316',
  'Financial Times': '#fbbf24',
  'Seeking Alpha': '#ef4444',
  'Google News':   '#8b5cf6',
  'AP':            '#94a3b8',
};

const FALLBACK_COLORS = ['#64748b', '#78716c', '#6b7280', '#71717a', '#737373'];

function getPublisherColor(publisher) {
  for (const [key, color] of Object.entries(PUBLISHER_COLORS)) {
    if (publisher.includes(key)) return color;
  }
  let hash = 0;
  for (let i = 0; i < publisher.length; i++) {
    hash = publisher.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function timeAgo(unixTimestamp) {
  const seconds = Math.floor(Date.now() / 1000 - unixTimestamp);
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function NewsSkeletonLoader() {
  return (
    <div className="news-feed-skeleton">
      <div className="news-feed-skeleton-hero">
        {[0, 1].map(i => (
          <div key={i} className="news-feed-skeleton-hero-card">
            <div className="skeleton-line" style={{ width: '100%', height: '60%', borderRadius: 8 }} />
            <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton-line" style={{ width: '85%', height: 14 }} />
              <div className="skeleton-line" style={{ width: '60%', height: 11 }} />
              <div className="skeleton-line" style={{ width: 80, height: 9, marginTop: 4 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="news-feed-skeleton-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="news-feed-skeleton-card">
            <div className="skeleton-line" style={{ width: '100%', height: 90, borderRadius: 6 }} />
            <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div className="skeleton-line" style={{ width: '90%', height: 12 }} />
              <div className="skeleton-line" style={{ width: '70%', height: 12 }} />
              <div className="skeleton-line" style={{ width: 70, height: 9, marginTop: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroCard({ article }) {
  const pubColor = getPublisherColor(article.publisher);
  return (
    <a
      className="news-feed-hero-card"
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div
        className="news-feed-hero-image"
        style={{ backgroundImage: `url(${article.thumbnail})` }}
      />
      <div className="news-feed-hero-overlay" />
      <div className="news-feed-hero-content">
        <span className="news-feed-publisher-badge" style={{ background: pubColor }}>
          {article.publisher}
        </span>
        <h2 className="news-feed-hero-title">{article.title}</h2>
        <span className="news-feed-hero-time">{timeAgo(article.publishedAt)}</span>
      </div>
    </a>
  );
}

function NewsCard({ article }) {
  const pubColor = getPublisherColor(article.publisher);
  const hasThumbnail = !!article.thumbnail;

  return (
    <a
      className={`news-feed-card${hasThumbnail ? ' news-feed-card--with-image' : ''}`}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      style={!hasThumbnail ? { borderLeftColor: pubColor } : undefined}
    >
      {hasThumbnail && (
        <div
          className="news-feed-card-image"
          style={{ backgroundImage: `url(${article.thumbnail})` }}
        />
      )}
      <div className="news-feed-card-body">
        <div className="news-feed-card-publisher" style={{ color: pubColor }}>
          {article.publisher}
        </div>
        <div className="news-feed-card-title">{article.title}</div>
        <div className="news-feed-card-time">{timeAgo(article.publishedAt)}</div>
      </div>
    </a>
  );
}

export default function NewsFeed({ active }) {
  const { articles, loading, lastUpdated } = useNewsFeed(active);

  if (loading && articles.length === 0) {
    return (
      <main className="news-feed-main">
        <NewsSkeletonLoader />
      </main>
    );
  }

  const heroArticles = articles.filter(a => a.thumbnail).slice(0, 2);
  const heroSet = new Set(heroArticles);
  const gridArticles = articles.filter(a => !heroSet.has(a));

  return (
    <main className="news-feed-main">
      <div className="news-feed-header">
        <h1 className="news-feed-title">News</h1>
        {lastUpdated && (
          <span className="news-feed-updated">
            Updated {timeAgo(Math.floor(lastUpdated.getTime() / 1000))}
          </span>
        )}
      </div>

      {heroArticles.length > 0 && (
        <section className={`news-feed-hero${heroArticles.length === 1 ? ' news-feed-hero--single' : ''}`}>
          {heroArticles.map((article, i) => (
            <HeroCard key={i} article={article} />
          ))}
        </section>
      )}

      <section className="news-feed-grid">
        {gridArticles.map((article, i) => (
          <NewsCard key={i} article={article} />
        ))}
      </section>

      {articles.length === 0 && !loading && (
        <div className="news-feed-empty">
          No news articles available right now. Refreshing automatically...
        </div>
      )}
    </main>
  );
}
