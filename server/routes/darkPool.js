import { Router } from 'express';
import { withCache } from '../middleware/cache.js';

const router = Router();
const QUIVER_BASE = 'https://api.quiverquant.com/beta';

function quiverHeaders() {
  return {
    'Authorization': `Bearer ${process.env.QUIVER_API_TOKEN}`,
    'Accept': 'application/json',
  };
}

let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1800_000; // 30 minutes

async function fetchDarkPool() {
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedResult;
  }

  const res = await fetch(`${QUIVER_BASE}/live/offexchange`, {
    headers: quiverHeaders(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Quiver API error: ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('Unexpected response');

  // Get latest date per ticker (data has multiple dates)
  const latest = {};
  for (const d of raw) {
    const ticker = (d.Ticker || '').toUpperCase().trim();
    if (!ticker) continue;
    const existing = latest[ticker];
    if (!existing || (d.Date || '') > (existing.Date || '')) {
      latest[ticker] = d;
    }
  }

  const stocks = Object.values(latest)
    .map(d => ({
      ticker: d.Ticker,
      date: d.Date,
      shortVolume: d.OTC_Short || 0,
      totalVolume: d.OTC_Total || 0,
      shortPercent: d.DPI != null ? d.DPI : (d.OTC_Total ? d.OTC_Short / d.OTC_Total : 0),
    }))
    .filter(d => d.totalVolume > 0)
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 100);

  // Top by dark pool activity
  const topByVolume = stocks.slice(0, 8).map(s => ({
    ticker: s.ticker,
    totalVolume: s.totalVolume,
    shortPercent: s.shortPercent,
  }));

  cachedResult = {
    count: stocks.length,
    timestamp: new Date().toISOString(),
    stocks,
    topByVolume,
  };
  cacheTimestamp = Date.now();
  console.log(`[dark-pool] Loaded ${raw.length} entries, ${stocks.length} tickers from Quiver API`);
  return cachedResult;
}

router.get('/', withCache(1800), async (req, res, next) => {
  try {
    const result = await fetchDarkPool();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
