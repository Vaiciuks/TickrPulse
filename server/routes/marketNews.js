import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { fetchMarketNews } from '../lib/yahooFetch.js';

const router = Router();

// GET /api/market-news — general market headlines for the ticker banner
router.get('/', withCache(120), async (req, res, next) => {
  try {
    const articles = await fetchMarketNews();
    res.json({ articles });
  } catch (error) {
    next(error);
  }
});

export default router;
