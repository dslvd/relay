import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface FallbackEntry {
  windowStart: number;
  count: number;
}

// Shared fixed-window rate limiter. Backed by Redis (atomic INCR + a TTL set
// only on the window's first hit) so the limit is enforced consistently
// across every serverless instance - a per-instance `global.*` counter (the
// old pattern here) only enforces `limit * however-many-warm-instances-exist`
// once traffic is spread across more than one instance.
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();

  if (hasRedisConfigured()) {
    const redis = await getRedisClient();
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pExpire(redisKey, windowMs);
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + windowMs,
    };
  }

  if (typeof global.rateLimitFallbackStore === 'undefined') {
    global.rateLimitFallbackStore = {};
  }
  const store = global.rateLimitFallbackStore;
  const entry = store[key] || { windowStart: now, count: 0 };
  if (now - entry.windowStart > windowMs) {
    entry.windowStart = now;
    entry.count = 0;
  }
  entry.count += 1;
  store[key] = entry;

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.windowStart + windowMs,
  };
}

declare global {
  var rateLimitFallbackStore: Record<string, FallbackEntry> | undefined;
}
