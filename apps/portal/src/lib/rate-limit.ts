interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();

  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanup();
    lastCleanup = now;
  }

  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    store.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetMs: config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: entry.resetTime - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetMs: entry.resetTime - now,
  };
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function rateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil((Date.now() + result.resetMs) / 1000)),
    "Retry-After": result.allowed ? "0" : String(Math.ceil(result.resetMs / 1000)),
  };
}

export const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  signup: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  chat: { windowMs: 60 * 1000, maxRequests: 30 },
  copilot: { windowMs: 60 * 1000, maxRequests: 20 },
  upload: { windowMs: 60 * 1000, maxRequests: 10 },
  evaluation: { windowMs: 60 * 1000, maxRequests: 15 },
  research: { windowMs: 60 * 1000, maxRequests: 20 },
  api: { windowMs: 60 * 1000, maxRequests: 60 },
} as const;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;
