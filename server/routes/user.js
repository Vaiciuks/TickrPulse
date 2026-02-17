import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function getSupabase(req) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: req.headers.authorization } } }
  );
}

// GET /api/user/profile
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const supabase = getSupabase(req);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json({ profile: data });
  } catch (err) { next(err); }
});

// GET /api/user/favorites
router.get('/favorites', requireAuth, async (req, res, next) => {
  try {
    const supabase = getSupabase(req);
    const { data, error } = await supabase
      .from('user_favorites')
      .select('symbol')
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ favorites: data.map(r => r.symbol) });
  } catch (err) { next(err); }
});

// PUT /api/user/favorites — full replace (sync from client)
router.put('/favorites', requireAuth, async (req, res, next) => {
  try {
    const { symbols } = req.body;
    if (!Array.isArray(symbols)) return res.status(400).json({ error: 'symbols must be an array' });
    const supabase = getSupabase(req);
    await supabase.from('user_favorites').delete().eq('user_id', req.user.id);
    if (symbols.length > 0) {
      const rows = symbols.map(s => ({ user_id: req.user.id, symbol: s }));
      const { error } = await supabase.from('user_favorites').insert(rows);
      if (error) throw error;
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/user/alerts
router.get('/alerts', requireAuth, async (req, res, next) => {
  try {
    const supabase = getSupabase(req);
    const { data, error } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ alerts: data });
  } catch (err) { next(err); }
});

// PUT /api/user/alerts — full replace
router.put('/alerts', requireAuth, async (req, res, next) => {
  try {
    const { alerts } = req.body;
    if (!Array.isArray(alerts)) return res.status(400).json({ error: 'alerts must be an array' });

    // Check premium tier — free users limited to 3 active alerts
    const supabase = getSupabase(req);
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', req.user.id)
      .single();

    const activeAlerts = alerts.filter(a => a.active !== false);
    if (profile?.tier !== 'premium' && activeAlerts.length > 3) {
      return res.status(403).json({ error: 'Free tier limited to 3 active alerts. Upgrade to Premium for unlimited.' });
    }

    await supabase.from('user_alerts').delete().eq('user_id', req.user.id);
    if (alerts.length > 0) {
      const rows = alerts.map(a => ({
        user_id: req.user.id,
        symbol: a.symbol,
        target_price: a.targetPrice,
        direction: a.direction,
        active: a.active !== false,
      }));
      const { error } = await supabase.from('user_alerts').insert(rows);
      if (error) throw error;
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
