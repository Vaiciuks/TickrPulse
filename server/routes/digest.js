import { Router } from 'express';
import { withCache } from '../middleware/cache.js';
import { fetchMarketNews } from '../lib/yahooFetch.js';
import { optionalAuth } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

let cachedDigest = null;
let cacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function generateDigest() {
  const now = Date.now();
  if (cachedDigest && now - cacheTime < CACHE_DURATION) {
    return cachedDigest;
  }

  const articles = await fetchMarketNews();
  if (!articles || articles.length === 0) {
    return null;
  }

  // Filter to prioritize market-focused articles
  const marketKeywords = /\bstock|market|\bS&P\b|Nasdaq|\bDow\b|\bshares\b|\brally|\bdrop|\bfell\b|\brise[sd]?\b|\bsurg|\bplung|\bearnings|\bFed\b|\binflation|\bGDP\b|\bjobs\b|\bCPI\b|\btreasur|\boil\b|\bgold\b|\bbitcoin|\bcrypto|\bIPO\b|\bindex|\bbull\b|\bbear\b|\bselloff|\bsell-off/i;
  const marketArticles = articles.filter(a => marketKeywords.test(a.title));
  const bestArticles = marketArticles.length >= 5 ? marketArticles : articles;

  const headlines = bestArticles.map(a => `- ${a.title} (${a.publisher})`).join('\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const digest = {
      headline: bestArticles[0].title,
      bullets: bestArticles.slice(1, 8).map(a => a.title),
      timestamp: Math.floor(now / 1000),
    };
    cachedDigest = digest;
    cacheTime = now;
    return digest;
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a financial news editor writing today's market digest. Focus on what actually happened TODAY in the markets.

Today's headlines from financial news sources:
${headlines}

Respond in this exact JSON format (no markdown, no code fences, just raw JSON):
{
  "headline": "One-sentence summary of today's dominant market narrative (max 120 chars)",
  "bullets": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6", "Point 7", "Point 8"]
}

Rules:
- The headline MUST describe today's specific market action (e.g. "S&P 500 rallies on strong jobs data" not "Markets remain volatile")
- Include 6-8 bullet points about today's most important developments
- Each bullet should be 1-2 sentences, factual and specific with numbers when available
- Prioritize: index moves (S&P, Nasdaq, Dow), big stock movers, Fed/macro events, sector rotation, earnings, commodities
- Ignore generic/evergreen articles — only include today's actionable developments
- Do NOT include generic advice, opinions, or forward-looking predictions`
      }],
    });

    const text = response.content[0].text.trim();
    const digest = JSON.parse(text);
    digest.timestamp = Math.floor(now / 1000);

    cachedDigest = digest;
    cacheTime = now;
    return digest;
  } catch (err) {
    console.error('Digest generation error:', err.message);
    const digest = {
      headline: bestArticles[0].title,
      bullets: bestArticles.slice(1, 8).map(a => a.title),
      timestamp: Math.floor(now / 1000),
    };
    cachedDigest = digest;
    cacheTime = now;
    return digest;
  }
}

async function checkPremium(req) {
  if (!req.user) return false;
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.authorization } } }
    );
    const { data } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', req.user.id)
      .single();
    return data?.tier === 'premium';
  } catch {
    return false;
  }
}

router.get('/', optionalAuth, withCache(300), async (req, res, next) => {
  try {
    const premium = await checkPremium(req);

    if (!premium) {
      // Free tier: return raw headlines without AI summary
      const articles = await fetchMarketNews();
      if (!articles || articles.length === 0) {
        return res.json({ digest: null });
      }
      const digest = {
        headline: articles[0].title,
        bullets: articles.slice(1, 8).map(a => a.title),
        timestamp: Math.floor(Date.now() / 1000),
      };
      return res.json({ digest });
    }

    // Premium: full AI digest
    const digest = await generateDigest();
    if (!digest) {
      return res.json({ digest: null });
    }
    res.json({ digest });
  } catch (error) {
    next(error);
  }
});

export default router;
