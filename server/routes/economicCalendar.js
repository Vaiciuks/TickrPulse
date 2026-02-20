import { Router } from 'express';
import { withCache } from '../middleware/cache.js';

const router = Router();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const TV_CALENDAR_URL = 'https://economic-calendar.tradingview.com/events';

// High-impact event keywords — the ones that actually move markets
const HIGH_IMPACT_KEYWORDS = [
  'fomc', 'interest rate', 'federal funds',
  'nonfarm', 'non-farm', 'non farm', 'payroll',
  'cpi', 'inflation rate', 'consumer price',
  'gdp', 'gross domestic',
  'pce', 'personal consumption',
  'ppi', 'producer price',
  'retail sales',
  'unemployment rate',
  'ism manufacturing', 'ism services', 'ism non-manufacturing',
  'consumer confidence',
  'housing starts', 'building permits',
  'durable goods',
  'trade balance',
  'jolts', 'job openings',
  'initial claims', 'jobless claims',
  'michigan', 'consumer sentiment',
];

// Skip minor variants and speeches
const SKIP_PATTERNS = [
  /\bspeech\b/i,
  /\bmom\b/i,      // Month-over-month variants (we keep the main figure)
  /\bqoq\b/i,      // Keep headline, skip QoQ variant
  /\byoy\b/i,      // Keep headline, skip YoY variant
  /\bex transp\b/i, // Durable goods ex transportation
  /\bex defense\b/i,
];

function isHighImpact(event) {
  const title = (event.title || '').toLowerCase();
  const indicator = (event.indicator || '').toLowerCase();
  const combined = title + ' ' + indicator;

  // Always skip Fed speeches and minor variants
  if (SKIP_PATTERNS.some(p => p.test(event.title || ''))) return false;

  // Keep importance=1 events
  if (event.importance === 1) return true;

  // Keep keyword matches
  return HIGH_IMPACT_KEYWORDS.some(kw => combined.includes(kw));
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

router.get('/', withCache(300), async (req, res, next) => {
  try {
    // Fetch 3 months of data centered on now
    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - 1);
    const to = new Date(now);
    to.setMonth(to.getMonth() + 2);

    const url = `${TV_CALENDAR_URL}?from=${formatDate(from)}&to=${formatDate(to)}&countries=US`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Origin': 'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.log(`[economic-calendar] TradingView returned ${response.status}`);
      return res.json({ events: [] });
    }

    const data = await response.json();
    const allEvents = data.result || data;

    if (!Array.isArray(allEvents)) {
      return res.json({ events: [] });
    }

    // Filter to high-impact events
    const filtered = allEvents.filter(e => isHighImpact(e));

    // Deduplicate: same title on same day → keep the one with more data
    const deduped = new Map();
    for (const e of filtered) {
      const dateKey = (e.date || '').slice(0, 10);
      const titleKey = (e.title || '').toLowerCase().trim();
      const key = `${dateKey}|${titleKey}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, e);
      } else {
        // Keep the version with more data (forecast/actual)
        const existingScore = (existing.actual != null ? 2 : 0) + (existing.forecast != null ? 1 : 0);
        const newScore = (e.actual != null ? 2 : 0) + (e.forecast != null ? 1 : 0);
        if (newScore > existingScore) deduped.set(key, e);
      }
    }

    const events = Array.from(deduped.values())
      .map(e => ({
        id: e.id,
        title: e.title || e.indicator || 'Unknown',
        date: e.date,
        category: e.category || null,
        importance: e.importance,
        actual: e.actual ?? null,
        forecast: e.forecast ?? null,
        previous: e.previous ?? null,
        currency: e.currency || 'USD',
        source: e.source || null,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`[economic-calendar] ${allEvents.length} total → ${events.length} high-impact (deduped)`);
    res.json({ events, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[economic-calendar] Error:', error.message);
    next(error);
  }
});

export default router;
