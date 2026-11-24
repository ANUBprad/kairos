import "./lib/polyfills.js";
import express from "express";
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { registerRoutes } from "./routes/index.js";
import { errorHandler } from "./middleware/error-handler.middleware.js";
import { csrfProtection } from "./middleware/csrf.middleware.js";
import { inngest } from "./inngest/client.js";
import { serve } from "inngest/express";
import { functions } from "./inngest/index.js";
import { configureInngestServeEnv } from "./inngest/config.js";
import { assertServerEnv } from "./config/env.js";
import {
    authLimiter,
    globalApiLimiter,
    healthLimiter,
    webhookLimiter,
} from "./middleware/rate-limit.middleware.js";
import { optionalAuth } from "./middleware/require-auth.middleware.js";
import {
    REQUEST_ID_HEADER,
    requestIdMiddleware,
} from "./middleware/request-id.middleware.js";
import {
    getAllowedOrigins,
    getExpressTrustProxy,
} from "./config/network.js";
import { AppError } from "./types/app-error.js";
import { runHealthChecks } from "./services/health.services.js";
import { handleRazorpayWebhook } from "./controllers/payment.controller.js";
import { asyncHandler } from "./utils/async-handler.js";

/**
 * Builds the real Express application (Helmet, CORS, rate limits, CSRF, Better
 * Auth, webhook, all API routers, and the error handler).
 *
 * Keeping construction separate from `listen()` lets HTTP security tests
 * exercise the exact production middleware and route wiring against a
 * disposable database, without a second hand-rolled test app.
 */
export function createApp(): express.Express {
    configureInngestServeEnv();
    assertServerEnv();

    const allowedOrigins = getAllowedOrigins();

    const app = express();
    // Correlation first so even auth/CORS/webhook failures carry an id.
    app.use(requestIdMiddleware);

    // Only explicitly configured proxies are trusted; forwarded headers from
    // any other source cannot influence req.ip or rate-limit keys.
    app.set("trust proxy", getExpressTrustProxy());

    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" },
        }),
    );

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                const normalizedOrigin = origin.replace(/\/$/, "");
                if (allowedOrigins.includes(normalizedOrigin)) {
                    return callback(null, true);
                }
                callback(new AppError(403, "Origin not allowed by CORS"));
            },
            credentials: true,
            exposedHeaders: [
                "X-Conversation-Id",
                "x-conversation-id",
                REQUEST_ID_HEADER,
            ],
        }),
    );

    app.use("/api/auth", authLimiter);
    app.all("/api/auth/*splat", toNodeHandler(auth));

    app.post(
        "/api/payment/webhook",
        webhookLimiter,
        express.raw({ type: "application/json" }),
        asyncHandler(handleRazorpayWebhook),
    );

    // JSON bodies are API metadata only. File uploads go through Multer with
    // their own magic-byte checked limits (25 MB PDF / 15 MB image).
    app.use(express.json({ limit: "2mb" }));
    app.use(express.urlencoded({ limit: "2mb", extended: true }));

    // Better Auth, the HMAC webhook, and Inngest own their cross-request
    // protections and are exempted inside the middleware by path.
    app.use(csrfProtection);

    // Local podcast files are served only through
    // /api/audio/:workspaceId/:artifactId, which verifies workspace ownership
    // and applies path.basename before reading. Never expose uploads/ as a
    // public static directory: time-based filenames are guessable.

    app.use("/api/inngest", serve({ client: inngest, functions }));

    app.get("/", (_req, res) => {
        res.send("OpenBook API");
    });

    // Liveness probe: must never depend on external services.
    app.get("/healthz", (_req, res) => {
        res.status(200).json({ status: "ok", uptime: process.uptime() });
    });

    // Readiness/diagnostics probe: reports dependency status, 503 when degraded.
    app.get("/health", healthLimiter, async (_req, res) => {
        const { ok, checks } = await runHealthChecks();
        res.status(ok ? 200 : 503).json({
            status: ok ? "ok" : "degraded",
            checks,
        });
    });

    app.use("/api", optionalAuth, globalApiLimiter);

    registerRoutes(app);

    app.use(errorHandler);
    return app;
}
