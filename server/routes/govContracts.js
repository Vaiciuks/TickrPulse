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

function formatAmount(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  return Math.round(num);
}

async function fetchGovContracts() {
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedResult;
  }

  const res = await fetch(`${QUIVER_BASE}/live/govcontracts`, {
    headers: quiverHeaders(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Quiver API error: ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('Unexpected response');

  // Aggregate by ticker — sum contract amounts
  const byTicker = {};
  for (const c of raw) {
    const ticker = (c.Ticker || '').toUpperCase().trim();
    if (!ticker) continue;
    const amount = formatAmount(c.Amount);
    if (amount == null || amount <= 0) continue;
    if (!byTicker[ticker]) {
      byTicker[ticker] = { ticker, totalAmount: 0, contractCount: 0, quarters: new Set() };
    }
    byTicker[ticker].totalAmount += amount;
    byTicker[ticker].contractCount++;
    if (c.Qtr && c.Year) byTicker[ticker].quarters.add(`Q${c.Qtr} ${c.Year}`);
  }

  const contracts = Object.values(byTicker)
    .map(t => ({
      ticker: t.ticker,
      totalAmount: t.totalAmount,
      contractCount: t.contractCount,
      latestQuarter: [...t.quarters].sort().pop() || null,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 100);

  // Top sectors/tickers by volume
  const topRecipients = contracts.slice(0, 8).map(c => ({
    ticker: c.ticker,
    totalAmount: c.totalAmount,
    contractCount: c.contractCount,
  }));

  cachedResult = {
    count: contracts.length,
    timestamp: new Date().toISOString(),
    contracts,
    topRecipients,
  };
  cacheTimestamp = Date.now();
  console.log(`[gov-contracts] Loaded ${raw.length} contracts, ${contracts.length} tickers from Quiver API`);
  return cachedResult;
}

router.get('/', withCache(3600), async (req, res, next) => {
  try {
    const result = await fetchGovContracts();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
