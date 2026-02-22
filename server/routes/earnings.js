import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { SECTORS } from './heatmap.js';
import { yahooFetchRaw, USER_AGENT } from '../lib/yahooCrumb.js';

const router = Router();
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

// Build a symbol → sector name lookup from the heatmap SECTORS data
const sectorLookup = new Map();
for (const sector of SECTORS) {
  for (const ind of sector.industries) {
    for (const st of ind.stocks) {
      sectorLookup.set(st.symbol, sector.name);
    }
  }
}

// Parse Nasdaq's formatted currency strings like "$4,565,970,000,000" → number
function parseNasdaqCurrency(str) {
  if (!str) return null;
  const num = parseFloat(str.replace(/[$,]/g, ''));
  return isNaN(num) ? null : num;
}

// Fetch earnings for a single date from Nasdaq's public API
async function fetchNasdaqDay(dateStr) {
  try {
    const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${dateStr}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.rows || []).map(row => ({
      symbol: row.symbol,
      name: row.name || row.symbol,
      marketCap: parseNasdaqCurrency(row.marketCap),
      epsEstimate: parseNasdaqCurrency(row.epsForecast),
    }));
  } catch {
    return [];
  }
}

// Generate all weekday dates (Mon-Fri) between two date strings
function getWeekdays(fromStr, toStr) {
  const dates = [];
  const current = new Date(fromStr + 'T12:00:00');
  const end = new Date(toStr + 'T12:00:00');
  while (current <= end) {
    const day = current.getDay();
    if (day >= 1 && day <= 5) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

router.get('/', withCache(300), async (req, res, next) => {
  try {
    // Date range: 3 weeks back to 8 weeks forward
    const from = new Date();
    from.setDate(from.getDate() - 21);
    const to = new Date();
    to.setDate(to.getDate() + 56);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    const weekdays = getWeekdays(fromStr, toStr);

    // Stage 1: Fetch Nasdaq for all weekdays in batches of 15
    const earnings = {};
    const allSymbols = new Set();
    const NASDAQ_BATCH = 15;

    for (let i = 0; i < weekdays.length; i += NASDAQ_BATCH) {
      const batch = weekdays.slice(i, i + NASDAQ_BATCH);
      const results = await Promise.allSettled(batch.map(d => fetchNasdaqDay(d)));
      for (let j = 0; j < batch.length; j++) {
        const entries = results[j].status === 'fulfilled' ? results[j].value : [];
        if (entries.length === 0) continue;
        earnings[batch[j]] = entries.map(e => ({
          symbol: e.symbol,
          name: e.name,
          marketCap: e.marketCap,
          epsEstimate: e.epsEstimate,
          price: null,
          changePercent: null,
          sector: sectorLookup.get(e.symbol) || 'Other',
          epsTTM: null,
        }));
        for (const e of entries) allSymbols.add(e.symbol);
      }
    }

    // Stage 2: Enrich with Yahoo price data in parallel batches
    const symbols = [...allSymbols];
    const CHUNK_SIZE = 150;
    const MAX_CONCURRENT = 5;
    const fields = 'regularMarketPrice,regularMarketChangePercent,marketCap,shortName,longName,sector';
    const quoteMap = new Map();

    const chunks = [];
    for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
      chunks.push(symbols.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
      const batch = chunks.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.allSettled(
        batch.map(chunk => {
          const url = `${YAHOO_QUOTE_URL}?symbols=${chunk.join(',')}&fields=${fields}`;
          return yahooFetchRaw(url, { signal: AbortSignal.timeout(12000) })
            .then(r => r.ok ? r.json() : { quoteResponse: { result: [] } });
        })
      );
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const q of (r.value?.quoteResponse?.result || [])) {
          if (q.symbol) quoteMap.set(q.symbol, q);
        }
      }
    }

    // Apply Yahoo enrichment to Nasdaq entries
    for (const dateKey of Object.keys(earnings)) {
      for (const stock of earnings[dateKey]) {
        const q = quoteMap.get(stock.symbol);
        if (!q) continue;
        stock.price = q.regularMarketPrice ?? null;
        stock.changePercent = q.regularMarketChangePercent ?? null;
        if (q.marketCap) stock.marketCap = q.marketCap;
        stock.name = q.shortName || q.longName || stock.name;
        if (q.sector) stock.sector = sectorLookup.get(stock.symbol) || q.sector;
      }
      // Sort by market cap (Nasdaq provides market cap even without Yahoo enrichment)
      earnings[dateKey].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    }

    const totalStocks = Object.values(earnings).reduce((s, arr) => s + arr.length, 0);
    const enriched = Object.values(earnings).flat().filter(s => s.price != null).length;
    console.log(`[earnings] Nasdaq: ${allSymbols.size} symbols, ${totalStocks} total across ${Object.keys(earnings).length} dates, ${enriched} enriched with price`);

    res.json({ earnings, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

export default router;
