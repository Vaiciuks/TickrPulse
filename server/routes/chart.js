import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { fetchChart, fetchCryptoChart } from '../lib/yahooFetch.js';

const router = Router();

// Valid Yahoo Finance combinations
const VALID_RANGES = new Set(['1d', '5d', '1mo', '3mo', '6mo', 'ytd', '1y', '2y', '5y', '10y', 'max']);
const VALID_INTERVALS = new Set(['1m', '2m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo']);

// Cache TTLs per interval — must be shorter than client poll interval
const CACHE_TTL = {
  '1m': 3, '2m': 5, '5m': 10, '15m': 15, '30m': 20,
};

router.get('/:symbol', (req, res, next) => {
  const interval = req.query.interval || '5m';
  const ttl = CACHE_TTL[interval] || 30;
  withCache(ttl)(req, res, next);
}, async (req, res, next) => {
  try {
    const { symbol } = req.params;
    let { range = '1d', interval = '5m', prepost = 'true' } = req.query;

    if (!/^[\^A-Z0-9.\-=]{1,12}$/i.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    if (!VALID_RANGES.has(range)) range = '1d';
    if (!VALID_INTERVALS.has(interval)) interval = '5m';

    const includePrePost = prepost === 'true';

    // Use Coinbase for crypto 1m (Yahoo doesn't provide real OHLC at 1m for crypto)
    const isCrypto = symbol.toUpperCase().endsWith('-USD');
    const useCoinbase = isCrypto && (interval === '1m' || interval === '2m');
    let chartData;

    if (useCoinbase) {
      chartData = await fetchCryptoChart(symbol.toUpperCase(), 60);
      if (!chartData) chartData = await fetchChart(symbol, range, interval, includePrePost);
    } else {
      chartData = await fetchChart(symbol, range, interval, includePrePost);
    }

    res.json({
      symbol: symbol.toUpperCase(),
      range,
      interval,
      data: chartData,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
