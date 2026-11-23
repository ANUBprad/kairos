import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function ipKey(req: Request): string {
    return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
}

function clientKey(req: Request): string {
    const userId = req.session?.user?.id;
    if (userId) return `user:${userId}`;
    return ipKey(req);
}

/** Broad protection for all JSON API routes. */
export const globalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    message: { error: "Too many requests. Please try again later." },
});

/** Dedicated throttle for authentication endpoints (mounted before body parsing). */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKey,
    message: { error: "Too many authentication attempts. Please try again later." },
});

/** Provider webhooks are signature-authenticated; keep a generous safety cap. */
export const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKey,
    message: { error: "Webhook rate limit exceeded." },
});

/**
 * The dependency-checking /health endpoint performs live database queries.
 * Limit it so an anonymous caller cannot turn it into a load amplifier.
 * /healthz remains unthrottled: it is a pure liveness probe.
 */
export const healthLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKey,
    message: { error: "Health check rate limit exceeded." },
});

/** Stricter limits for ingestion, chat, and artifact generation (mutating methods). */
export const aiOperationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    skip: (req) => req.method === "GET" || req.method === "HEAD",
    message: {
        error: "AI operation rate limit exceeded. Please wait before retrying.",
    },
});
