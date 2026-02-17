import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { fetchChart } from '../lib/yahooFetch.js';

const router = Router();

// Batch endpoint: fetch chart data for multiple symbols in one request
// GET /api/charts?symbols=AAPL,TSLA,NVDA&range=1d&interval=5m
router.get('/', withCache(30), async (req, res, next) => {
  try {
    const { symbols, range = '1d', interval = '5m', prepost = 'true' } = req.query;

    if (!symbols) {
      return res.status(400).json({ error: 'symbols parameter required' });
    }

    const symbolList = symbols
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => /^[\^A-Z0-9.\-=]{1,12}$/.test(s))
      .slice(0, 50); // cap at 50 symbols

    const includePrePost = prepost === 'true';

    // Fetch all in parallel — concurrency is limited by yahooFetch queue
    const results = await Promise.allSettled(
      symbolList.map(sym => fetchChart(sym, range, interval, includePrePost).then(data => ({ sym, data })))
    );

    const charts = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        charts[result.value.sym] = result.value.data;
      }
    }

    res.json({ charts });
  } catch (error) {
    next(error);
  }
});

export default router;
