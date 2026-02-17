import { Router } from 'express';

const router = Router();
const TV_SCAN_URL = 'https://scanner.tradingview.com/america/scan';

// Body-based cache (withCache keys on URL, useless for POST)
const cache = new Map();
const CACHE_TTL = 15_000;
const MAX_CACHE = 100;

const COLUMNS = [
  'name',              // d[0] — "EXCHANGE:SYMBOL"
  'description',       // d[1] — company name
  'close',             // d[2] — current price
  'change',            // d[3] — change %
  'change_abs',        // d[4] — change $
  'volume',            // d[5]
  'market_cap_basic',  // d[6]
  'sector',            // d[7]
];

const BASE_FILTERS = [
  { left: 'type', operation: 'equal', right: 'stock' },
  { left: 'subtype', operation: 'not_in_range', right: ['preferred'] },
  { left: 'is_primary', operation: 'equal', right: true },
  { left: 'active_symbol', operation: 'equal', right: true },
  { left: 'close', operation: 'greater', right: 0.5 },         // exclude sub-penny stocks
  { left: 'exchange', operation: 'in_range', right: ['AMEX', 'NASDAQ', 'NYSE'] }, // US major exchanges only
];

const MARKET_CAP = {
  mega:  [{ left: 'market_cap_basic', operation: 'greater', right: 200e9 }],
  large: [
    { left: 'market_cap_basic', operation: 'greater', right: 10e9 },
    { left: 'market_cap_basic', operation: 'less', right: 200e9 },
  ],
  mid: [
    { left: 'market_cap_basic', operation: 'greater', right: 2e9 },
    { left: 'market_cap_basic', operation: 'less', right: 10e9 },
  ],
  small: [
    { left: 'market_cap_basic', operation: 'greater', right: 300e6 },
    { left: 'market_cap_basic', operation: 'less', right: 2e9 },
  ],
  micro: [{ left: 'market_cap_basic', operation: 'less', right: 300e6 }],
};

const CHANGE = {
  up5:   [{ left: 'change', operation: 'greater', right: 5 }],
  up2:   [{ left: 'change', operation: 'greater', right: 2 }],
  up0:   [{ left: 'change', operation: 'greater', right: 0 }],
  down:  [{ left: 'change', operation: 'less', right: 0 }],
  down2: [{ left: 'change', operation: 'less', right: -2 }],
  down5: [{ left: 'change', operation: 'less', right: -5 }],
};

const VOLUME = {
  '1m':    [{ left: 'volume', operation: 'greater', right: 1_000_000 }],
  '500k':  [{ left: 'volume', operation: 'greater', right: 500_000 }],
  '100k':  [{ left: 'volume', operation: 'greater', right: 100_000 }],
  unusual: [{ left: 'relative_volume_10d_calc', operation: 'greater', right: 2 }],
};

const PRICE = {
  under10:  [{ left: 'close', operation: 'less', right: 10 }],
  '10to50': [
    { left: 'close', operation: 'greater', right: 10 },
    { left: 'close', operation: 'less', right: 50 },
  ],
  '50to200': [
    { left: 'close', operation: 'greater', right: 50 },
    { left: 'close', operation: 'less', right: 200 },
  ],
  over200: [{ left: 'close', operation: 'greater', right: 200 }],
};

const SECTOR_MAP = {
  technology:     'Technology',
  healthcare:     'Health Technology',
  finance:        'Finance',
  energy:         'Energy Minerals',
  consumer:       'Consumer Non-Durables',
  industrials:    'Industrial Services',
  communications: 'Communications',
  utilities:      'Utilities',
  realestate:     'Real Estate',
  materials:      'Non-Energy Minerals',
};

const SORT_MAP = {
  change:    'change',
  volume:    'volume',
  marketCap: 'market_cap_basic',
  price:     'close',
};

function buildBody(filters) {
  const tvFilters = [...BASE_FILTERS];

  if (filters.marketCap && MARKET_CAP[filters.marketCap]) {
    tvFilters.push(...MARKET_CAP[filters.marketCap]);
  }
  if (filters.change && CHANGE[filters.change]) {
    tvFilters.push(...CHANGE[filters.change]);
  }
  if (filters.volume && VOLUME[filters.volume]) {
    tvFilters.push(...VOLUME[filters.volume]);
  }
  if (filters.price && PRICE[filters.price]) {
    tvFilters.push(...PRICE[filters.price]);
  }
  if (filters.sector && SECTOR_MAP[filters.sector]) {
    tvFilters.push({ left: 'sector', operation: 'equal', right: SECTOR_MAP[filters.sector] });
  }

  return {
    columns: COLUMNS,
    filter: tvFilters,
    options: { lang: 'en' },
    range: [0, 50],
    sort: {
      sortBy: SORT_MAP[filters.sortBy] || 'change',
      sortOrder: filters.sortOrder === 'asc' ? 'asc' : 'desc',
    },
  };
}

function parseResults(data) {
  if (!data?.data) return [];
  return data.data
    .map(item => {
      const d = item.d;
      const symbol = (item.s || '').split(':')[1] || (item.s || '');
      const close = d[2] || 0;         // current/last price
      const changePct = d[3] || 0;     // % change
      const changeAbs = d[4] || 0;     // $ change
      return {
        symbol,
        name: d[1] || symbol,
        price: close,
        changePercent: changePct,
        change: changeAbs,
        volume: d[5] || 0,
        marketCap: d[6] || 0,
        sector: d[7] || '',
      };
    })
    .filter(s => s.symbol && s.price > 0);
}

router.post('/', async (req, res, next) => {
  try {
    const cacheKey = JSON.stringify(req.body || {});
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json(cached.data);
    }

    const body = buildBody(req.body || {});
    const tvRes = await fetch(TV_SCAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!tvRes.ok) throw new Error(`TradingView ${tvRes.status}`);

    const raw = await tvRes.json();
    const stocks = parseResults(raw);

    const result = {
      count: stocks.length,
      totalCount: raw.totalCount || stocks.length,
      stocks,
      timestamp: new Date().toISOString(),
    };

    // Evict oldest if cache is full
    if (cache.size >= MAX_CACHE) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(cacheKey, { data: result, ts: Date.now() });

    console.log(`[screener] ${stocks.length} results (total: ${result.totalCount})`);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
