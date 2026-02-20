const stores = new Map();

/**
 * Simple in-memory rate limiter (no external dependencies).
 * @param {object} opts
 * @param {number} opts.windowMs  - Time window in ms (default 60s)
 * @param {number} opts.max       - Max requests per window (default 100)
 * @param {string} [opts.message] - Response message when limited
 */
export function rateLimit({ windowMs = 60_000, max = 100, message = 'Too many requests, please try again later.' } = {}) {
  const id = Symbol();
  stores.set(id, new Map());

  // Cleanup expired entries every 2 minutes
  const cleanup = setInterval(() => {
    const store = stores.get(id);
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.start > windowMs) store.delete(key);
    }
  }, 120_000);
  cleanup.unref?.();

  return (req, res, next) => {
    const store = stores.get(id);
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now - entry.start > windowMs) {
      entry = { count: 0, start: now };
      store.set(key, entry);
    }

    entry.count++;

    // Set standard rate-limit headers
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil((entry.start + windowMs) / 1000)));

    if (entry.count > max) {
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}
