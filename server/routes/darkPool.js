import { Router } from 'express';
import { withCache } from '../middleware/cache.js';

const router = Router();

// FINRA publishes daily short sale volume files (free, no API key needed)
// Format: Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market
const FINRA_BASE = 'https://cdn.finra.org/equity/regsho/daily';

let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1800_000; // 30 minutes

// Format a Date object as YYYYMMDD
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Format as YYYY-MM-DD for display
function fmtDisplay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Try fetching the most recent trading day's file (today, then yesterday, etc.)
async function fetchFinraFile() {
  const now = new Date();
  // Try last 5 days to account for weekends/holidays
  for (let i = 0; i < 5; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = fmt(d);
    const url = `${FINRA_BASE}/CNMSshvol${dateStr}.txt`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const text = await res.text();
        return { text, date: d };
      }
    } catch {
      // try next day
    }
  }
  throw new Error('No recent FINRA short volume data available');
}

async function fetchDarkPool() {
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedResult;
  }

  const { text, date } = await fetchFinraFile();
  const displayDate = fmtDisplay(date);
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('Date'));

  const tickers = {};
  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 5) continue;
    const symbol = parts[1];
    const shortVol = parseInt(parts[2], 10) || 0;
    const shortExempt = parseInt(parts[3], 10) || 0;
    const totalVol = parseInt(parts[4], 10) || 0;

    // Aggregate across markets for same symbol
    if (tickers[symbol]) {
      tickers[symbol].shortVolume += shortVol + shortExempt;
      tickers[symbol].totalVolume += totalVol;
    } else {
      tickers[symbol] = {
        ticker: symbol,
        date: displayDate,
        shortVolume: shortVol + shortExempt,
        totalVolume: totalVol,
      };
    }
  }

  const stocks = Object.values(tickers)
    .map(d => ({
      ...d,
      shortPercent: d.totalVolume > 0 ? d.shortVolume / d.totalVolume : 0,
    }))
    .filter(d => d.totalVolume > 100_000) // Only meaningful volume
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 100);

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
  console.log(`[dark-pool] FINRA ${displayDate}: ${lines.length} entries, ${stocks.length} tickers (top 100 by volume)`);
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
