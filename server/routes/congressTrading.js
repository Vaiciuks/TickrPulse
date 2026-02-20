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

function calcDelay(tradeDateStr, filingDateStr) {
  if (!tradeDateStr || !filingDateStr) return null;
  try {
    const trade = new Date(tradeDateStr);
    const filing = new Date(filingDateStr);
    if (isNaN(trade) || isNaN(filing)) return null;
    const diffMs = filing.getTime() - trade.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

function normalizeTrade(t) {
  const txType = (t.Transaction || '').toLowerCase();
  const isBuy = txType.includes('purchase');
  const txDate = t.TransactionDate || '';
  const reportDate = t.ReportDate || '';
  return {
    politician: t.Representative || t.Senator || 'Unknown',
    chamber: t.House === 'Representatives' ? 'House' : 'Senate',
    party: t.Party || null,
    ticker: (t.Ticker || '').toUpperCase().trim(),
    assetDescription: t.Description || '',
    type: isBuy ? 'Buy' : 'Sell',
    amount: t.Range || '',
    transactionDate: txDate,
    filingDate: reportDate,
    reportingDelay: calcDelay(txDate, reportDate),
    excessReturn: t.ExcessReturn != null ? t.ExcessReturn : null,
    priceChange: t.PriceChange != null ? t.PriceChange : null,
  };
}

// Module-level cache — Quiver data updates daily
let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1800_000; // 30 minutes

async function fetchAllCongressTrades() {
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedResult;
  }

  const res = await fetch(`${QUIVER_BASE}/live/congresstrading`, {
    headers: quiverHeaders(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`[congress-trading] Quiver API returned ${res.status}`);
    throw new Error(`Quiver API error: ${res.status}`);
  }

  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('Unexpected Quiver response');

  const trades = raw
    .map(normalizeTrade)
    .filter(t => t.ticker && t.ticker !== '--' && t.ticker !== 'N/A')
    .sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''));

  // Build "most active politicians" summary
  const politicianCounts = {};
  for (const t of trades) {
    const key = `${t.politician}|${t.chamber}`;
    if (!politicianCounts[key]) {
      politicianCounts[key] = { politician: t.politician, chamber: t.chamber, party: t.party, count: 0, buys: 0, sells: 0 };
    }
    politicianCounts[key].count++;
    if (t.type === 'Buy') politicianCounts[key].buys++;
    else politicianCounts[key].sells++;
  }
  const mostActive = Object.values(politicianCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  cachedResult = {
    count: trades.length,
    timestamp: new Date().toISOString(),
    trades: trades.slice(0, 200),
    mostActive,
  };
  cacheTimestamp = Date.now();
  console.log(`[congress-trading] Loaded ${trades.length} trades from Quiver API`);
  return cachedResult;
}

// GET /api/congress-trading — all recent trades
router.get('/', withCache(1800), async (req, res, next) => {
  try {
    const result = await fetchAllCongressTrades();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/congress-trading/:symbol — trades for a specific ticker
router.get('/:symbol', withCache(1800), async (req, res, next) => {
  try {
    const { symbol } = req.params;
    if (!/^[A-Z0-9.\-]{1,10}$/i.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    // Try per-ticker endpoint first for richer historical data
    const tickerRes = await fetch(`${QUIVER_BASE}/historical/congresstrading/${symbol.toUpperCase()}`, {
      headers: quiverHeaders(),
      signal: AbortSignal.timeout(10000),
    });

    if (tickerRes.ok) {
      const raw = await tickerRes.json();
      const trades = (Array.isArray(raw) ? raw : [])
        .map(normalizeTrade)
        .sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''))
        .slice(0, 100);
      return res.json({
        symbol: symbol.toUpperCase(),
        count: trades.length,
        timestamp: new Date().toISOString(),
        trades,
      });
    }

    // Fallback: filter from bulk data
    const result = await fetchAllCongressTrades();
    const symbolTrades = result.trades.filter(
      t => t.ticker === symbol.toUpperCase()
    );
    res.json({
      symbol: symbol.toUpperCase(),
      count: symbolTrades.length,
      timestamp: result.timestamp,
      trades: symbolTrades,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
