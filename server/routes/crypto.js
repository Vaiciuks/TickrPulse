import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { fetchQuote } from '../lib/yahooFetch.js';

const router = Router();

// Top cryptocurrencies (Yahoo Finance USD pairs)
const CRYPTO_SYMBOLS = [
  'BTC-USD',   // Bitcoin
  'ETH-USD',   // Ethereum
  'SOL-USD',   // Solana
  'XRP-USD',   // Ripple
  'ADA-USD',   // Cardano
  'DOGE-USD',  // Dogecoin
];

router.get('/', withCache(15), async (req, res, next) => {
  try {
    const results = await Promise.allSettled(
      CRYPTO_SYMBOLS.map(sym => fetchQuote(sym))
    );

    const stocks = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => {
        const q = r.value;
        return {
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          volume: q.volume,
          marketCap: q.marketCap,
          extPrice: null,
          extChange: null,
          extChangePercent: null,
          extMarketState: null,
        };
      })
      .filter(s => s.price != null);

    res.json({
      count: stocks.length,
      timestamp: new Date().toISOString(),
      stocks,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
