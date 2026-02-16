import type { Context, Next } from 'hono';
import { AppError } from '../shared/errors';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

/**
 * In-memory rate limiter middleware.
 * @param maxAttempts Max requests per window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimitMiddleware(maxAttempts: number = 10, windowMs: number = 15 * 60 * 1000) {
  return async (c: Context, next: Next) => {
    // Use IP + path as key
    // Prefer cf-connecting-ip (set authoritatively by Cloudflare, not spoofable)
    // Fall back to x-real-ip (set by trusted reverse proxies)
    // x-forwarded-for is intentionally NOT used — clients can spoof it to bypass rate limits
    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-real-ip')
      || 'unknown';
    const key = `${ip}:${c.req.path}`;

    const now = Date.now();
    const entry = store.get(key);

    if (entry && now < entry.resetAt) {
      if (entry.count >= maxAttempts) {
        throw new AppError(
          'RATE_LIMITED',
          'Too many attempts. Please try again later.',
          429
        );
      }
      entry.count++;
    } else {
      store.set(key, { count: 1, resetAt: now + windowMs });
    }

    await next();
  };
}
