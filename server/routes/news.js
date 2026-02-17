import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { fetchNews } from '../lib/yahooFetch.js';

const router = Router();

// GET /api/news/:symbol — single symbol news
router.get('/:symbol', withCache(300), async (req, res, next) => {
  try {
    const { symbol } = req.params;
    if (!/^[\^A-Z0-9.\-=]{1,12}$/i.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    const news = await fetchNews(symbol.toUpperCase());
    res.json({ symbol: symbol.toUpperCase(), news });
  } catch (error) {
    next(error);
  }
});

// GET /api/news?symbols=AAPL,TSLA — batch
router.get('/', withCache(300), async (req, res, next) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ error: 'symbols parameter required' });
    }

    const symbolList = symbols
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => /^[\^A-Z0-9.\-=]{1,12}$/.test(s))
      .slice(0, 50);

    const results = await Promise.allSettled(
      symbolList.map(sym =>
        fetchNews(sym).then(news => ({ sym, news }))
      )
    );

    const newsMap = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        newsMap[result.value.sym] = result.value.news;
      }
    }

    res.json({ news: newsMap });
  } catch (error) {
    next(error);
  }
});

export default router;
