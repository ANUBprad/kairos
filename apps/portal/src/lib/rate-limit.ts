type RateLimitStore = {
  [key: string]: { count: number; resetAt: number };
};

const store: RateLimitStore = {};

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; resetAt: Date }> {
  const now = Date.now();
  const record = store[key];

  if (!record || now > record.resetAt) {
    store[key] = { count: 1, resetAt: now + windowMs };
    return { success: true, remaining: maxAttempts - 1, resetAt: new Date(now + windowMs) };
  }

  if (record.count >= maxAttempts) {
    return { success: false, remaining: 0, resetAt: new Date(record.resetAt) };
  }

  record.count++;
  return { success: true, remaining: maxAttempts - record.count, resetAt: new Date(record.resetAt) };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
