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
const CACHE_DURATION = 3600_000; // 1 hour

async function fetchLobbying() {
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedResult;
  }

  const res = await fetch(`${QUIVER_BASE}/live/lobbying`, {
    headers: quiverHeaders(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Quiver API error: ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('Unexpected response');

  // Aggregate by ticker
  const byTicker = {};
  for (const l of raw) {
    const ticker = (l.Ticker || '').toUpperCase().trim();
    if (!ticker) continue;
    const amount = parseFloat(l.Amount) || 0;
    if (!byTicker[ticker]) {
      byTicker[ticker] = { ticker, totalSpent: 0, filingCount: 0, issues: new Set(), clients: new Set() };
    }
    byTicker[ticker].totalSpent += amount;
    byTicker[ticker].filingCount++;
    if (l.Issue) byTicker[ticker].issues.add(l.Issue);
    if (l.Client) byTicker[ticker].clients.add(l.Client);
  }

  const lobbying = Object.values(byTicker)
    .map(t => ({
      ticker: t.ticker,
      totalSpent: Math.round(t.totalSpent),
      filingCount: t.filingCount,
      topIssues: [...t.issues].slice(0, 3),
      clientCount: t.clients.size,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 100);

  const topSpenders = lobbying.slice(0, 8).map(l => ({
    ticker: l.ticker,
    totalSpent: l.totalSpent,
    filingCount: l.filingCount,
  }));

  cachedResult = {
    count: lobbying.length,
    timestamp: new Date().toISOString(),
    lobbying,
    topSpenders,
  };
  cacheTimestamp = Date.now();
  console.log(`[lobbying] Loaded ${raw.length} filings, ${lobbying.length} tickers from Quiver API`);
  return cachedResult;
}

router.get('/', withCache(3600), async (req, res, next) => {
  try {
    const result = await fetchLobbying();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
