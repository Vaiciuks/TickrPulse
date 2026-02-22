import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { yahooAuthFetch, USER_AGENT } from '../lib/yahooCrumb.js';

const router = Router();
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const YAHOO_SUMMARY = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
const NASDAQ_BASE = 'https://api.nasdaq.com/api';

function getApiKey() {
  return process.env.FINNHUB_API_KEY || '';
}

async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (res.status === 429) throw new Error('Finnhub rate limit reached');
  if (!res.ok) throw new Error(`Finnhub returned ${res.status}`);
  return res.json();
}

function fmtRev(val) {
  if (val == null) return '--';
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function generateHighlights({ epsHistory, revenueHistory, recommendation, streak, financialData }) {
  const highlights = [];

  // 1. Latest Quarter Results
  const latestEps = [...epsHistory].filter(q => q.actual != null).pop();
  const latestRev = [...revenueHistory].filter(q => q.revenueActual != null).pop();

  if (latestEps || latestRev) {
    const parts = [];
    const qLabel = latestEps?.quarter && latestEps?.year
      ? `Q${latestEps.quarter} ${latestEps.year}` : 'Latest Quarter';

    if (latestEps?.actual != null && latestEps?.estimate != null) {
      const verb = latestEps.beat ? 'beat' : latestEps.actual < latestEps.estimate ? 'missed' : 'met';
      const surprise = latestEps.surprisePercent != null
        ? ` by ${Math.abs(latestEps.surprisePercent).toFixed(1)}%` : '';
      parts.push(`EPS of $${latestEps.actual.toFixed(2)} ${verb} the estimate of $${latestEps.estimate.toFixed(2)}${surprise}`);
    }
    if (latestRev?.revenueActual != null && latestRev?.revenueEstimate != null) {
      const verb = latestRev.beat ? 'beat' : latestRev.revenueActual < latestRev.revenueEstimate ? 'missed' : 'met';
      parts.push(`Revenue of ${fmtRev(latestRev.revenueActual)} ${verb} the estimate of ${fmtRev(latestRev.revenueEstimate)}`);
    } else if (latestRev?.revenueActual != null) {
      parts.push(`Revenue came in at ${fmtRev(latestRev.revenueActual)}`);
    }

    if (parts.length > 0) {
      highlights.push({ title: `${qLabel} Results`, detail: parts.join('. ') + '.' });
    }
  }

  // 2. Revenue Growth (YoY comparison)
  const revsWithActual = revenueHistory.filter(q => q.revenueActual != null);
  if (revsWithActual.length >= 4) {
    const current = revsWithActual[revsWithActual.length - 1];
    const yearAgo = revsWithActual.find(
      q => q.quarter === current.quarter && q.year === current.year - 1
    );
    if (current.revenueActual && yearAgo?.revenueActual) {
      const growth = ((current.revenueActual - yearAgo.revenueActual) / Math.abs(yearAgo.revenueActual)) * 100;
      const dir = growth >= 0 ? 'grew' : 'declined';
      highlights.push({
        title: 'Revenue Growth',
        detail: `Revenue ${dir} ${Math.abs(growth).toFixed(1)}% year-over-year from ${fmtRev(yearAgo.revenueActual)} to ${fmtRev(current.revenueActual)}.`,
      });
    }
  }

  // 3. Profitability (from Yahoo financialData)
  if (financialData) {
    const parts = [];
    if (financialData.profitMargins != null) {
      parts.push(`profit margin of ${(financialData.profitMargins * 100).toFixed(1)}%`);
    }
    if (financialData.grossMargins != null) {
      parts.push(`gross margin of ${(financialData.grossMargins * 100).toFixed(1)}%`);
    }
    if (financialData.revenueGrowth != null) {
      const g = (financialData.revenueGrowth * 100).toFixed(1);
      parts.push(`quarterly revenue growth of ${g >= 0 ? '+' : ''}${g}%`);
    }
    if (parts.length > 0) {
      const joined = parts.join(', ');
      highlights.push({
        title: 'Profitability',
        detail: joined.charAt(0).toUpperCase() + joined.slice(1) + '.',
      });
    }
  }

  // 4. Earnings Consistency (streak)
  if (streak?.type !== 'none' && streak?.count >= 2) {
    const verb = streak.type === 'beat' ? 'beaten' : streak.type === 'miss' ? 'missed' : 'met';
    highlights.push({
      title: 'Earnings Consistency',
      detail: `The company has ${verb} analyst EPS estimates for ${streak.count} consecutive quarters.`,
    });
  }

  // 5. Analyst Sentiment
  if (recommendation) {
    const total = recommendation.strongBuy + recommendation.buy + recommendation.hold + recommendation.sell + recommendation.strongSell;
    if (total > 0) {
      const bullish = recommendation.strongBuy + recommendation.buy;
      const bullishPct = ((bullish / total) * 100).toFixed(0);
      const consensus = bullishPct >= 70 ? 'Strong Buy'
        : bullishPct >= 50 ? 'Buy' : bullishPct >= 30 ? 'Hold' : 'Sell';
      highlights.push({
        title: 'Analyst Consensus',
        detail: `${bullishPct}% of ${total} analysts rate this stock Buy or Strong Buy. Overall consensus: ${consensus}.`,
      });
    }
  }

  // 6. Price Target (from Yahoo financialData)
  if (financialData?.targetMeanPrice && financialData?.currentPrice) {
    const upside = ((financialData.targetMeanPrice - financialData.currentPrice) / financialData.currentPrice) * 100;
    const dir = upside >= 0 ? 'upside' : 'downside';
    highlights.push({
      title: 'Price Target',
      detail: `Mean analyst price target of $${financialData.targetMeanPrice.toFixed(2)} implies ${Math.abs(upside).toFixed(1)}% ${dir} from the current price of $${financialData.currentPrice.toFixed(2)}.`,
    });
  }

  return highlights;
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
    const sym = encodeURIComponent(symbol.toUpperCase());

    // Wide date range for calendar earnings (3 years back to 6 months forward)
    const from = new Date();
    from.setFullYear(from.getFullYear() - 3);
    const to = new Date();
    to.setMonth(to.getMonth() + 6);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    // Yahoo Finance for quarterly data (added 'earnings' module for earningsChart)
    async function fetchYahooQuarterly() {
      try {
        const url = `${YAHOO_SUMMARY}/${sym}?modules=incomeStatementHistoryQuarterly,earningsHistory,earningsTrend,financialData,earnings`;
        return await yahooAuthFetch(url);
      } catch {
        return null;
      }
    }

    // Nasdaq earnings-surprise (4 quarters of EPS actual vs consensus)
    async function fetchNasdaqSurprise() {
      try {
        const res = await fetch(`${NASDAQ_BASE}/company/${sym}/earnings-surprise`, {
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.data?.earningsSurpriseTable?.rows || [];
      } catch {
        return [];
      }
    }

    const [epsResult, recResult, calResult, yahooResult, nasdaqResult] = await Promise.allSettled([
      apiKey ? fetchJSON(`${FINNHUB_BASE}/stock/earnings?symbol=${sym}&limit=20&token=${apiKey}`) : [],
      apiKey ? fetchJSON(`${FINNHUB_BASE}/stock/recommendation?symbol=${sym}&token=${apiKey}`) : [],
      apiKey ? fetchJSON(`${FINNHUB_BASE}/calendar/earnings?symbol=${sym}&from=${fromStr}&to=${toStr}&token=${apiKey}`) : { earningsCalendar: [] },
      fetchYahooQuarterly(),
      fetchNasdaqSurprise(),
    ]);

    // Calendar data (has revenue + sometimes more recent EPS)
    const calRaw = calResult.status === 'fulfilled'
      ? (calResult.value?.earningsCalendar || [])
      : [];

    // Extract Yahoo data early — used by both EPS and revenue sections
    const yahooData = yahooResult.status === 'fulfilled' ? yahooResult.value : null;

    // EPS history from /stock/earnings endpoint
    const epsRaw = epsResult.status === 'fulfilled' ? (epsResult.value || []) : [];

    // Yahoo earningsChart.quarterly — has 4 quarters with actual + estimate + surprise
    const yahooEarningsChart = yahooData?.quoteSummary?.result?.[0]
      ?.earnings?.earningsChart?.quarterly || [];

    // Nasdaq earnings-surprise — 4 quarters with EPS actual + consensus forecast
    const nasdaqSurprise = nasdaqResult.status === 'fulfilled' ? nasdaqResult.value : [];

    // Build a merged EPS history from ALL sources, keyed by period-end date
    // to avoid fiscal-vs-calendar year duplicates
    const epsByPeriod = new Map();

    // Helper: find existing entry by period-end date proximity (within 45 days)
    function findByDateProximity(dateStr) {
      if (!dateStr) return null;
      const target = new Date(dateStr).getTime();
      for (const [key, entry] of epsByPeriod) {
        const diff = Math.abs(new Date(key).getTime() - target);
        if (diff < 45 * 86400000) return entry; // within 45 days
      }
      return null;
    }

    // 1) Yahoo earningsChart.quarterly (most reliable — has periodEndDate, actual, estimate)
    for (const q of yahooEarningsChart) {
      const periodEnd = q.periodEndDate?.fmt;
      if (!periodEnd) continue;
      const calQ = q.calendarQuarter || q.date || '';
      const qMatch = calQ.match(/(\d)Q(\d{4})/);
      epsByPeriod.set(periodEnd, {
        period: periodEnd,
        quarter: qMatch ? parseInt(qMatch[1]) : 0,
        year: qMatch ? parseInt(qMatch[2]) : 0,
        actual: q.actual?.raw ?? null,
        estimate: q.estimate?.raw ?? null,
        surprisePercent: parseFloat(q.surprisePct) || null,
      });
    }

    // 2) Finnhub /stock/earnings — add quarters not already covered by Yahoo
    for (const q of epsRaw) {
      if (!q.period) continue;
      const existing = findByDateProximity(q.period);
      if (existing) {
        // Merge: fill in missing data
        if (existing.estimate == null && q.estimate != null) existing.estimate = q.estimate;
        if (existing.surprisePercent == null && q.surprisePercent != null) existing.surprisePercent = q.surprisePercent;
      } else {
        epsByPeriod.set(q.period, {
          period: q.period,
          quarter: q.quarter || 0,
          year: q.year || 0,
          actual: q.actual ?? null,
          estimate: q.estimate ?? null,
          surprisePercent: q.surprisePercent ?? null,
        });
      }
    }

    // 3) Nasdaq earnings-surprise — fill in estimates for entries that are missing them
    for (const row of nasdaqSurprise) {
      if (row.eps == null) continue;
      const consensus = parseFloat(String(row.consensusForecast).replace(/[$,]/g, ''));
      if (isNaN(consensus)) continue;

      // Match by similar EPS actual value
      for (const [, existing] of epsByPeriod) {
        if (existing.estimate != null) continue;
        if (existing.actual == null) continue;
        if (Math.abs(existing.actual - row.eps) < 0.015) {
          existing.estimate = consensus;
          if (existing.surprisePercent == null) {
            existing.surprisePercent = parseFloat(row.percentageSurprise) || null;
          }
          break;
        }
      }
    }

    // 4) Finnhub calendar — add future quarters and any remaining historical quarters
    for (const e of calRaw) {
      if (e.epsActual == null && e.epsEstimate == null) continue;
      if (!e.date) continue;

      const existing = findByDateProximity(e.date);
      if (existing) {
        if (existing.estimate == null && e.epsEstimate != null) existing.estimate = e.epsEstimate;
        if (existing.actual == null && e.epsActual != null) existing.actual = e.epsActual;
      } else {
        const surprise = (e.epsActual != null && e.epsEstimate != null && e.epsEstimate !== 0)
          ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100
          : null;
        epsByPeriod.set(e.date, {
          period: e.date,
          quarter: e.quarter || 0,
          year: e.year || 0,
          actual: e.epsActual ?? null,
          estimate: e.epsEstimate ?? null,
          surprisePercent: surprise,
        });
      }
    }

    // Final dedup: remove entries that share the same actual EPS and are within 90 days
    const sortedEps = [...epsByPeriod.entries()]
      .filter(([, q]) => q.actual != null || q.estimate != null)
      .sort(([a], [b]) => a.localeCompare(b));

    const dedupedEps = [];
    for (const [key, entry] of sortedEps) {
      const dup = dedupedEps.find(e =>
        e.actual != null && entry.actual != null
        && Math.abs(e.actual - entry.actual) < 0.015
        && Math.abs(new Date(e.period).getTime() - new Date(entry.period).getTime()) < 90 * 86400000
      );
      if (dup) {
        // Keep the one with more data (prefer one with estimate)
        if (entry.estimate != null && dup.estimate == null) dup.estimate = entry.estimate;
        if (entry.surprisePercent != null && dup.surprisePercent == null) dup.surprisePercent = entry.surprisePercent;
      } else {
        dedupedEps.push(entry);
      }
    }

    const epsHistory = dedupedEps.slice(-16).map(q => ({
      ...q,
      beat: q.actual != null && q.estimate != null ? q.actual > q.estimate : null,
    }));

    // Revenue history: merge Yahoo quarterly income + Finnhub calendar
    const revByQtr = new Map(); // key: "Q{q}-{year}"

    // 1) Yahoo quarterly income statements (deeper history, actual revenue only)
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

    // Sort oldest-first by year+quarter (date-based sort breaks for Finnhub
    // announcement dates vs Yahoo period-end dates), then compute beat/miss
    const revenueHistory = [...revByQtr.values()]
      .sort((a, b) => (a.year - b.year) || (a.quarter - b.quarter))
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

    // Extract Yahoo financialData for highlights
    const rawFinancial = yahooData?.quoteSummary?.result?.[0]?.financialData;
    const financialData = rawFinancial ? {
      currentPrice: rawFinancial.currentPrice?.raw ?? null,
      targetMeanPrice: rawFinancial.targetMeanPrice?.raw ?? null,
      targetHighPrice: rawFinancial.targetHighPrice?.raw ?? null,
      targetLowPrice: rawFinancial.targetLowPrice?.raw ?? null,
      profitMargins: rawFinancial.profitMargins?.raw ?? null,
      grossMargins: rawFinancial.grossMargins?.raw ?? null,
      operatingMargins: rawFinancial.operatingMargins?.raw ?? null,
      revenueGrowth: rawFinancial.revenueGrowth?.raw ?? null,
      earningsGrowth: rawFinancial.earningsGrowth?.raw ?? null,
    } : null;

    // Generate highlights from all collected data
    const highlights = generateHighlights({
      epsHistory, revenueHistory, recommendation, streak, financialData,
    });

    res.json({
      symbol: symbol.toUpperCase(),
      epsHistory,
      revenueHistory,
      recommendation,
      nextEarningsDate,
      streak,
      highlights,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
