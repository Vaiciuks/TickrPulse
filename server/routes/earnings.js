import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { SECTORS } from './heatmap.js';

const router = Router();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const SCREENER_URL = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved';

// Build a symbol → sector name lookup from the heatmap SECTORS data
const sectorLookup = new Map();
for (const sector of SECTORS) {
  for (const ind of sector.industries) {
    for (const st of ind.stocks) {
      sectorLookup.set(st.symbol, sector.name);
    }
  }
}

// Fetch stocks from a Yahoo screener
async function fetchScreener(scrId, count = 100) {
  try {
    const res = await fetch(`${SCREENER_URL}?scrIds=${scrId}&count=${count}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.finance?.result?.[0]?.quotes || [];
  } catch {
    return [];
  }
}

// Extract earnings timestamp from Yahoo's format (number or array)
function extractTs(val) {
  if (!val && val !== 0) return null;
  if (typeof val === 'number') return val;
  if (Array.isArray(val) && val.length > 0) return val[0];
  return null;
}

router.get('/', withCache(120), async (req, res, next) => {
  try {
    // Fetch from multiple screeners in parallel for wide coverage
    const [actives, gainers, losers, growth, undervalued] = await Promise.allSettled([
      fetchScreener('most_actives', 200),
      fetchScreener('day_gainers', 100),
      fetchScreener('day_losers', 100),
      fetchScreener('growth_technology_stocks', 100),
      fetchScreener('undervalued_large_caps', 100),
    ]);

    // Merge all quotes, deduplicate by symbol
    const seen = new Map();
    const allQuotes = [actives, gainers, losers, growth, undervalued]
      .map(r => r.status === 'fulfilled' ? r.value : [])
      .flat();

    for (const q of allQuotes) {
      if (!q.symbol || seen.has(q.symbol)) continue;
      const ts = extractTs(q.earningsTimestamp) || extractTs(q.earningsTimestampStart);
      if (!ts) continue;
      seen.set(q.symbol, {
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice,
        changePercent: q.regularMarketChangePercent,
        marketCap: q.marketCap,
        sector: sectorLookup.get(q.symbol) || q.sector || 'Other',
        epsEstimate: q.epsCurrentYear ?? q.epsForward ?? null,
        epsTTM: q.epsTrailingTwelveMonths ?? null,
        earningsTs: ts,
      });
    }

    // Group by date, filter to ±12 weeks
    const now = Date.now() / 1000;
    const window = 84 * 24 * 60 * 60;
    const earnings = {};

    for (const stock of seen.values()) {
      if (Math.abs(stock.earningsTs - now) > window) continue;
      const dateKey = new Date(stock.earningsTs * 1000).toISOString().split('T')[0];
      if (!earnings[dateKey]) earnings[dateKey] = [];
      earnings[dateKey].push({
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        changePercent: stock.changePercent,
        marketCap: stock.marketCap,
        sector: stock.sector,
        epsEstimate: stock.epsEstimate,
        epsTTM: stock.epsTTM,
      });
    }

    // Sort each day by market cap
    for (const dateKey of Object.keys(earnings)) {
      earnings[dateKey].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    }

    const totalStocks = Object.values(earnings).reduce((s, arr) => s + arr.length, 0);
    console.log(`[earnings] ${seen.size} unique stocks with dates, ${totalStocks} within window across ${Object.keys(earnings).length} dates`);

    res.json({ earnings, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

export default router;
