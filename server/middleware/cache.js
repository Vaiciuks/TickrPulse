const cache = new Map();

export function withCache(ttlSeconds) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttlSeconds * 1000) {
      return res.json(cached.data);
    }

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      // Only cache successful responses (not error objects)
      if (res.statusCode < 400 && !data?.error) {
        cache.set(key, { data, timestamp: Date.now() });
      }
      return originalJson(data);
    };

    next();
  };
}
