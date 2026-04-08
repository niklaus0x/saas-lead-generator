/**
 * Rate Limiter v5
 * In-memory rate limiting — no Redis required
 * Protects all API endpoints from abuse
 */

const requests = new Map(); // ip -> [timestamps]

function rateLimiter({ maxRequests = 60, windowMs = 60 * 1000, message = 'Too many requests' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!requests.has(ip)) requests.set(ip, []);
    const times = requests.get(ip).filter(t => t > windowStart);
    times.push(now);
    requests.set(ip, times);

    const remaining = Math.max(0, maxRequests - times.length);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + windowMs) / 1000));

    if (times.length > maxRequests) {
      return res.status(429).json({ error: message, retryAfter: Math.ceil(windowMs / 1000) });
    }
    next();
  };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [ip, times] of requests.entries()) {
    const fresh = times.filter(t => t > cutoff);
    if (fresh.length === 0) requests.delete(ip);
    else requests.set(ip, fresh);
  }
}, 5 * 60 * 1000);

// Specific limiters
const searchLimiter = rateLimiter({ maxRequests: 10, windowMs: 60 * 1000, message: 'Search rate limit: 10 searches per minute' });
const apiLimiter = rateLimiter({ maxRequests: 120, windowMs: 60 * 1000, message: 'API rate limit: 120 requests per minute' });
const emailLimiter = rateLimiter({ maxRequests: 20, windowMs: 60 * 1000, message: 'Email rate limit: 20 emails per minute' });

module.exports = { rateLimiter, searchLimiter, apiLimiter, emailLimiter };
