# TickrView

Real-time stock market dashboard with live quotes, interactive charts, heatmaps, AI-powered market digests, smart money tracking, and more.

**Live:** [tickrview.com](https://tickrview.com)

---

## Features

### Home Dashboard
- Drag-and-drop reorderable sections — customize the layout to your preference
- **Market Pulse** hero card with live S&P 500 data
- **Market Breadth** bar — advancing vs. declining stocks with A/D ratio
- Scrolling news ticker with real-time headlines
- Top Runners, Top Losers, Trending, Pre/After-Market Movers
- Fear & Greed gauge (VIX + market breadth weighted score)
- Futures, Crypto, Earnings, Economic Calendar, Latest News, Favorites
- Sections can be hidden/shown and reset to default
- Layout persisted to localStorage

### Charts & Analysis
- Full-screen interactive charts powered by TradingView's Lightweight Charts
- **15 timeframes:** 1m, 2m, 5m, 15m, 30m, 1h, 2h, 4h, Daily, Weekly, Monthly, YTD, 1Y, 5Y, Max
- **Chart types:** Candlestick (rounded), Heikin-Ashi, Line, Area, Bar
- **Indicators:** EMA 9, EMA 21, VWAP, RSI (14), MACD — memoized to skip recalculation when unrelated settings change
- **Drawing tools:** Horizontal line, Trendline, Ray, Fibonacci retracement — with live SVG preview and measurement badge
- **Drawing persistence** — drawings saved per symbol and timeframe in localStorage, restored automatically
- **Chart state persistence** — indicator toggles, chart type, and timeframe saved per symbol
- **Compare overlay** — add a second symbol for side-by-side percentage analysis
- **Session highlighting** — pre-market, regular hours, and after-hours zones visualized on intraday charts
- **High/Low markers** — visible-range high and low automatically marked and updated on scroll/zoom
- Key statistics sidebar, related news panel, earnings date badge
- Screenshot/snip mode — drag to capture chart area to clipboard or PNG
- Auto-refreshes on intraday timeframes (10s–60s intervals)
- Volume bars with square-root scaling and server-side outlier cleaning

### S&P 500 Heatmap
- Interactive treemap with sector, industry, and individual stock drill-down
- Color intensity scales with daily % change
- Built from scratch — squarified treemap algorithm computed in-browser from live market data

### AI Daily Digest
- Scrolling headline banner with expandable full digest modal
- Claude AI generates structured market summaries from filtered news headlines
- Falls back to top curated financial headlines when AI is unavailable
- Two-layer keyword filtering ensures only market-relevant content

### Smart Money (8 sub-tabs)
| Tab | Description | Data Source |
|-----|-------------|-------------|
| **WSB** | Reddit stock mention tracker with sentiment and rank changes | ApeWisdom |
| **Insider Trading** | SEC Form 4 insider buy/sell transactions | Finnhub |
| **Options Flow** | Unusual options activity scanner with call/put ratios | Yahoo Finance |
| **Short Interest** | % of float short, short ratio, squeeze level indicators | Yahoo Finance |
| **Congress** | STOCK Act politician trading disclosures | Quiver Quantitative |
| **Gov Contracts** | Federal contracts awarded to public companies | Quiver Quantitative |
| **Lobbying** | Corporate lobbying disclosure data | Quiver Quantitative |
| **Dark Pool** | FINRA off-exchange volume and short volume data | FINRA |

### Portfolio Tracker
- Add positions with buy price, quantity, and date
- Real-time P&L with day change tracking
- Allocation pie chart breakdown
- Sortable holdings table
- Data persisted locally

### Additional Sections
- **Earnings Calendar** — week-by-week view of upcoming earnings reports with scrollable stock list
- **Earnings Lookup** — historical EPS and revenue vs. estimates, analyst consensus, and surprise history for any symbol
- **Economic Calendar** — monthly view of high-impact macro events (FOMC, CPI, NFP, GDP, etc.)
- **Stock Screener** — filter by market cap, % change, volume, price range, and sector
- **News Feed** — aggregated headlines from CNBC, Bloomberg, MarketWatch, and Google News
- **Extended Hours Movers** — pre-market and after-hours top gainers/losers
- **Futures & Indices** — live quotes with mini sparkline charts
- **Crypto** — cryptocurrency prices via Coinbase
- **Contact Form** — built-in feedback form with email delivery via Gmail SMTP

### User Features
- **Price Alerts** — set target prices with browser notifications
- **Favorites** — star any stock, drag to reorder, synced across devices when signed in
- **Watchlist Sidebar** — collapsible sidebar with recent stocks, favorites, and portfolio preview
- **Stock Notes** — add personal notes to any stock card
- **Multi-Chart Grid** — Ctrl+click stocks to view multiple charts simultaneously
- **Dark/Light Theme** — toggle with preference saved locally
- **Market Status Detection** — automatically detects pre-market, regular, post-market, and holiday sessions
- **PWA Support** — installable as a standalone app on mobile and desktop
- **No account required** — all features work instantly with localStorage; sign in optionally for cloud sync

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `J` / `K` | Navigate between stock cards |
| `Enter` | Open chart for focused stock |
| `F` | Toggle favorite on focused stock |
| `1`–`8` | Switch chart timeframes |
| `Esc` | Close chart / cancel drawing / clear selection |
| `Ctrl+Click` | Add stock to multi-chart grid |
| `?` | Toggle help panel |

---

## Performance & Reliability

- **Code splitting** — 11 tab components lazy-loaded with React.lazy, cutting initial bundle from 801 KB to 634 KB
- **Indicator memoization** — EMA, RSI, MACD, VWAP wrapped in useMemo so toggling chart type doesn't recalculate indicators
- **Retry with exponential backoff** — shared retryFetch utility retries on 5xx/429 errors (1s → 2s → 4s) with AbortSignal support
- **AbortController** — switching timeframes cancels in-flight chart requests to prevent stale data flashes
- **Server-side caching** — in-memory cache with 30s–60min TTLs depending on data type
- **Batch requests** — single API call fetches quotes for 30+ symbols at once
- **Tab-level error boundaries** — a crash in one tab doesn't take down the whole app
- **Stale data indicator** — "Updated X ago" badge with color-coded freshness (green/amber/red)
- **NaN guards** — all price/percent formatters safely handle null, NaN, and Infinity values
- **Volume outlier cleaning** — two-pass server-side filter removes Yahoo's cumulative volume snapshot artifacts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5 |
| **Charts** | TradingView Lightweight Charts |
| **Backend** | Node.js, Express |
| **Auth & Storage** | Supabase (PostgreSQL) |
| **AI** | Anthropic Claude API |
| **Deployment** | Railway |

---

## Project Structure

```
TickrView/
├── public/                  # Static assets, PWA manifest, favicon
├── server/
│   ├── app.js               # Express app setup (middleware, routes)
│   ├── index.js             # Server entry point
│   ├── lib/
│   │   ├── yahooCrumb.js    # Yahoo Finance session/crumb auth
│   │   └── yahooFetch.js    # Core data fetching (quotes, charts, news)
│   ├── middleware/
│   │   ├── auth.js          # Supabase JWT auth (required + optional)
│   │   ├── cache.js         # In-memory response cache
│   │   ├── errorHandler.js  # Classified error responses
│   │   └── rateLimit.js     # IP-based rate limiter
│   └── routes/              # 32 API route files
├── src/
│   ├── App.jsx              # Root component with tab routing
│   ├── App.css              # All application styles
│   ├── components/          # 41 React components
│   ├── contexts/
│   │   └── AuthContext.jsx  # Supabase auth provider
│   ├── hooks/               # 28 custom hooks
│   ├── utils/               # Indicators, formatters, retryFetch
│   └── lib/
│       └── authFetch.js     # Fetch wrapper with auth headers
├── index.html
├── vite.config.js
└── package.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/Vaiciuks/TickrView.git
cd TickrView
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Required for AI Digest
ANTHROPIC_API_KEY=

# Supabase (auth + cloud sync)
SUPABASE_URL=
SUPABASE_ANON_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Finnhub (insider trading, earnings lookup)
FINNHUB_API_KEY=

# Quiver Quantitative (congress trading, gov contracts, lobbying)
QUIVER_API_TOKEN=

# Gmail SMTP (contact form)
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

> The app works without any API keys — core features like quotes, charts, heatmap, screener, and news use Yahoo Finance which requires no authentication. API keys enable additional features (AI digest, insider trading, congress data, etc.).

### Development

```bash
npm run dev
```

This starts both the Express backend (port 3001) and Vite dev server (port 5173) concurrently. The Vite dev server proxies `/api/*` requests to the backend.

### Production Build

```bash
npm run build
npm start
```

The Express server serves the built frontend from `dist/` and handles all API routes.

---

## External APIs

| API | Purpose | Auth Required |
|-----|---------|:---:|
| Yahoo Finance | Quotes, charts, options, search, news | No (crumb-based) |
| Coinbase Exchange | Crypto OHLC data | No |
| Anthropic Claude | AI market digest | Yes |
| Supabase | Auth, favorites, alerts sync | Yes |
| Finnhub | Insider trading, earnings history | Yes |
| Quiver Quantitative | Congress trades, gov contracts, lobbying, dark pool | Yes |
| ApeWisdom | Reddit stock mentions (WSB) | No |
| FINRA | Dark pool short volume | No |
| TradingView | Economic calendar, screener | No |
| RSS Feeds | News (CNBC, Bloomberg, MarketWatch, Google News) | No |

---

## Architecture Notes

- **No WebSockets** — all real-time updates use polling (quotes every ~15s, charts every 10–60s depending on timeframe)
- **All API calls proxy through Express** — keeps API keys server-side and avoids CORS issues
- **Auth is fully optional** — all features work without an account; signing in enables cloud sync across devices
- **In-memory caching** at the server level reduces upstream API calls (30s–60min TTLs depending on data type)
- **Yahoo Finance crumb/cookie auth** is managed server-side with auto-refresh on expiry and retry on rate limits
- **Price animations** use requestAnimationFrame with cubic ease-out for smooth ticker-style transitions
- **Drag-and-drop** uses raw DOM manipulation via RAF loops for zero React re-renders during drag
- **Error classification** — backend maps HTTP status codes to user-friendly categories (rate_limited, upstream_down, not_found, etc.)

---

## License

All rights reserved.
