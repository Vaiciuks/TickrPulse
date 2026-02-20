import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { yahooAuthFetch } from '../lib/yahooCrumb.js';

const router = Router();
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const YAHOO_SUMMARY = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';

function getApiKey() {
  return process.env.FINNHUB_API_KEY || '';
}

async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (res.status === 429) throw new Error('Finnhub rate limit reached');
  if (!res.ok) throw new Error(`Finnhub returned ${res.status}`);
  return res.json();
}

function computeStreak(quarters) {
  if (!quarters.length) return { type: 'none', count: 0 };

  // quarters should be sorted newest-first
  const sorted = [...quarters].sort((a, b) => (b.period || '').localeCompare(a.period || ''));

  let type = null;
  let count = 0;

  for (const q of sorted) {
    if (q.actual == null || q.estimate == null) continue;
    const beat = q.actual > q.estimate;
    const miss = q.actual < q.estimate;
    const current = beat ? 'beat' : miss ? 'miss' : 'met';

    if (type === null) {
      type = current;
      count = 1;
    } else if (current === type) {
      count++;
    } else {
      break;
    }
  }

  return { type: type || 'none', count };
}

// GET /api/earnings-lookup/:symbol
router.get('/:symbol', withCache(300), async (req, res, next) => {
  try {
    const { symbol } = req.params;
    if (!/^[A-Z0-9.\-]{1,10}$/i.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });
    }

    const sym = encodeURIComponent(symbol.toUpperCase());

    // Wide date range for calendar earnings (3 years back to 6 months forward)
    const from = new Date();
    from.setFullYear(from.getFullYear() - 3);
    const to = new Date();
    to.setMonth(to.getMonth() + 6);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    // Yahoo Finance for quarterly revenue history + earnings trend (for revenue estimates)
    async function fetchYahooQuarterly() {
      try {
        const url = `${YAHOO_SUMMARY}/${sym}?modules=incomeStatementHistoryQuarterly,earningsHistory,earningsTrend`;
        return await yahooAuthFetch(url);
      } catch {
        return null;
      }
    }

    const [epsResult, recResult, calResult, yahooResult] = await Promise.allSettled([
      fetchJSON(`${FINNHUB_BASE}/stock/earnings?symbol=${sym}&limit=20&token=${apiKey}`),
      fetchJSON(`${FINNHUB_BASE}/stock/recommendation?symbol=${sym}&token=${apiKey}`),
      fetchJSON(`${FINNHUB_BASE}/calendar/earnings?symbol=${sym}&from=${fromStr}&to=${toStr}&token=${apiKey}`),
      fetchYahooQuarterly(),
    ]);

    // Calendar data (has revenue + sometimes more recent EPS)
    const calRaw = calResult.status === 'fulfilled'
      ? (calResult.value?.earningsCalendar || [])
      : [];

    // EPS history from /stock/earnings endpoint
    const epsRaw = epsResult.status === 'fulfilled' ? (epsResult.value || []) : [];

    // Build a merged EPS history: start with /stock/earnings, then fill in
    // any quarters from calendar that have actual EPS data but aren't in epsRaw
    const epsByPeriod = new Map();

    // Add all from /stock/earnings (keyed by period date)
    for (const q of epsRaw) {
      if (!q.period) continue;
      epsByPeriod.set(q.period, {
        period: q.period,
        quarter: q.quarter || 0,
        year: q.year || 0,
        actual: q.actual ?? null,
        estimate: q.estimate ?? null,
        surprisePercent: q.surprisePercent ?? null,
      });
    }

    // Merge calendar entries that have actual EPS data and aren't already covered
    for (const e of calRaw) {
      if (e.epsActual == null && e.epsEstimate == null) continue;
      if (!e.date) continue;

      // Calendar dates may not match exact period-end dates from /stock/earnings.
      // Use quarter+year as a fallback key to avoid duplicates.
      const qKey = `Q${e.quarter}-${e.year}`;
      const alreadyHas = [...epsByPeriod.values()].some(
        existing => existing.quarter === e.quarter && existing.year === e.year
      );

      if (!alreadyHas) {
        // Derive a period-end date from the calendar entry
        const periodEnd = e.date; // best approximation
        const surprise = (e.epsActual != null && e.epsEstimate != null && e.epsEstimate !== 0)
          ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100
          : null;
        epsByPeriod.set(periodEnd, {
          period: periodEnd,
          quarter: e.quarter || 0,
          year: e.year || 0,
          actual: e.epsActual ?? null,
          estimate: e.epsEstimate ?? null,
          surprisePercent: surprise,
        });
      }
    }

    // Sort oldest-first, take last 16 quarters for display
    const allEps = [...epsByPeriod.values()]
      .filter(q => q.actual != null || q.estimate != null)
      .sort((a, b) => (a.period || '').localeCompare(b.period || ''));

    const epsHistory = allEps.slice(-16).map(q => ({
      ...q,
      beat: q.actual != null && q.estimate != null ? q.actual > q.estimate : null,
    }));

    // Revenue history: merge Yahoo quarterly income + Finnhub calendar
    const revByQtr = new Map(); // key: "Q{q}-{year}"

    // 1) Yahoo quarterly income statements (deeper history, actual revenue only)
    const yahooData = yahooResult.status === 'fulfilled' ? yahooResult.value : null;
    const yahooIncome = yahooData?.quoteSummary?.result?.[0]
      ?.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];

    // Yahoo earningsTrend — has forward-looking revenue estimates (0q, +1q)
    const earningsTrend = yahooData?.quoteSummary?.result?.[0]?.earningsTrend?.trend || [];

    for (const stmt of yahooIncome) {
      const rev = stmt.totalRevenue?.raw;
      if (rev == null) continue;
      const endDate = stmt.endDate?.fmt || ''; // "2025-12-31"
      if (!endDate) continue;
      const month = parseInt(endDate.split('-')[1], 10);
      const year = parseInt(endDate.split('-')[0], 10);
      const quarter = Math.ceil(month / 3);
      const key = `Q${quarter}-${year}`;

      revByQtr.set(key, {
        date: endDate,
        quarter,
        year,
        revenueActual: rev,
        revenueEstimate: null, // Yahoo doesn't provide estimates here
      });
    }

    // 2) Finnhub calendar entries (has estimates + recent actuals)
    // Both Finnhub and Yahoo return revenue in raw dollars (no unit conversion needed).
    // Match by date proximity (not quarter key) because Finnhub uses fiscal
    // quarters while Yahoo uses calendar quarters derived from end-date month,
    // which disagree for companies whose fiscal year doesn't align to calendar.
    for (const e of calRaw) {
      if (e.revenueActual == null && e.revenueEstimate == null) continue;

      const revActual = e.revenueActual ?? null;
      const revEstimate = e.revenueEstimate ?? null;
      const announceDate = e.date ? new Date(e.date) : null;

      // Try to find a matching Yahoo entry by date proximity.
      // Earnings are typically announced 20-75 days after quarter end.
      let matched = null;
      if (announceDate) {
        let bestDiff = Infinity;
        for (const [, existing] of revByQtr) {
          if (!existing.date) continue;
          const endDate = new Date(existing.date);
          const daysDiff = (announceDate - endDate) / (1000 * 60 * 60 * 24);
          if (daysDiff >= 0 && daysDiff <= 100 && daysDiff < bestDiff) {
            bestDiff = daysDiff;
            matched = existing;
          }
        }
      }

      if (matched) {
        if (revEstimate != null && matched.revenueEstimate == null) {
          matched.revenueEstimate = revEstimate;
        }
        if (revActual != null && matched.revenueActual == null) {
          matched.revenueActual = revActual;
        }
      } else {
        // No Yahoo entry nearby — add as a new entry (e.g. future quarter)
        const key = `Q${e.quarter}-${e.year}`;
        const existing = revByQtr.get(key);
        if (existing) {
          if (revEstimate != null && existing.revenueEstimate == null) {
            existing.revenueEstimate = revEstimate;
          }
          if (revActual != null && existing.revenueActual == null) {
            existing.revenueActual = revActual;
          }
        } else {
          revByQtr.set(key, {
            date: e.date || '',
            quarter: e.quarter || 0,
            year: e.year || 0,
            revenueActual: revActual,
            revenueEstimate: revEstimate,
          });
        }
      }
    }

    // 3) Yahoo earningsTrend — add forward-looking revenue estimates for
    // upcoming quarters (0q, +1q) by matching via yearAgoRevenue to the
    // historical quarter exactly one year prior.
    for (const t of earningsTrend) {
      if (t.period !== '0q' && t.period !== '+1q') continue;
      const estAvg = t.revenueEstimate?.avg?.raw;
      if (estAvg == null) continue;

      const yearAgoRev = t.revenueEstimate?.yearAgoRevenue?.raw;
      if (yearAgoRev == null) continue;

      // Find the Yahoo entry whose actual matches yearAgoRevenue, then
      // target the quarter one year later.
      for (const [, existing] of revByQtr) {
        if (existing.revenueActual === yearAgoRev && existing.date) {
          const agoDate = new Date(existing.date);
          const targetYear = agoDate.getFullYear() + 1;
          const targetMonth = agoDate.getMonth() + 1;
          const targetQ = Math.ceil(targetMonth / 3);
          const targetKey = `Q${targetQ}-${targetYear}`;

          const target = revByQtr.get(targetKey);
          if (target && target.revenueEstimate == null) {
            target.revenueEstimate = estAvg;
          } else if (!target) {
            // Create a new entry for this upcoming quarter
            const targetEndDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${existing.date.split('-')[2]}`;
            revByQtr.set(targetKey, {
              date: targetEndDate,
              quarter: targetQ,
              year: targetYear,
              revenueActual: null,
              revenueEstimate: estAvg,
            });
          }
          break;
        }
      }
    }

    // Sort oldest-first, compute beat/miss
    const revenueHistory = [...revByQtr.values()]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(-12)
      .map(r => ({
        ...r,
        beat: r.revenueActual != null && r.revenueEstimate != null
          ? r.revenueActual > r.revenueEstimate : null,
      }));

    // Next earnings date — find future dates from calendar
    const now = new Date();
    const futureEarnings = calRaw
      .filter(e => new Date(e.date) > now)
      .sort((a, b) => a.date.localeCompare(b.date));
    const nextEarningsDate = futureEarnings[0]?.date || null;

    // Analyst recommendation — take the most recent entry
    const recRaw = recResult.status === 'fulfilled' ? (recResult.value || []) : [];
    const latestRec = recRaw.sort((a, b) => (b.period || '').localeCompare(a.period || ''))[0] || null;
    const recommendation = latestRec ? {
      period: latestRec.period,
      strongBuy: latestRec.strongBuy || 0,
      buy: latestRec.buy || 0,
      hold: latestRec.hold || 0,
      sell: latestRec.sell || 0,
      strongSell: latestRec.strongSell || 0,
    } : null;

    // Compute beat/miss streak from merged EPS data (newest first)
    const streakInput = [...epsByPeriod.values()]
      .filter(q => q.actual != null)
      .map(q => ({ ...q, period: q.period }));
    const streak = computeStreak(streakInput);

    res.json({
      symbol: symbol.toUpperCase(),
      epsHistory,
      revenueHistory,
      recommendation,
      nextEarningsDate,
      streak,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
