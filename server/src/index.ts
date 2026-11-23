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
import { cleanupExpiredOAuthNonces } from "./lib/oauth-state.js";
import { recoverAbandonedDurableJobs } from "./lib/outbox.js";
import { inngest } from "./inngest/client.js";
import { serve } from "inngest/express";
import { functions } from "./inngest/index.js";
import {
    configureInngestServeEnv,
    logInngestStartupMode,
} from "./inngest/config.js";
import { assertServerEnv, getServerEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";
import {
    authLimiter,
    globalApiLimiter,
    webhookLimiter,
} from "./middleware/rate-limit.middleware.js";
import { optionalAuth } from "./middleware/require-auth.middleware.js";
import {
    getAllowedOrigins,
    getExpressTrustProxy,
} from "./config/network.js";
import { AppError } from "./types/app-error.js";
import { runHealthChecks } from "./services/health.services.js";
import { handleRazorpayWebhook } from "./controllers/payment.controller.js";
import { asyncHandler } from "./utils/async-handler.js";

configureInngestServeEnv();
const env = assertServerEnv();

const allowedOrigins = getAllowedOrigins();

const app = express();
// Only explicitly configured proxies are trusted; forwarded headers from any
// other source cannot influence req.ip or rate-limit keys.
app.set("trust proxy", getExpressTrustProxy());
const PORT = env.PORT;

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
        exposedHeaders: ["X-Conversation-Id", "x-conversation-id"],
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

// JSON bodies are API metadata only. File uploads go through Multer with their
// own magic-byte checked limits (25 MB PDF / 15 MB image), so accepting large
// generic bodies here only creates a memory-exhaustion surface.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// Better Auth (/api/auth), the HMAC webhook, and Inngest have their own
// protections and are exempted inside the middleware by path.
app.use(csrfProtection);

if (env.NODE_ENV !== "production") {
    app.use("/uploads", express.static("uploads"));
}

app.use("/api/inngest", serve({ client: inngest, functions }));

app.get("/", (_req, res) => {
    res.send("OpenBook API");
});

// Liveness probe: must never depend on external services (DB, Pinecone, ...).
// Render's health check uses this; a 503 here fails the whole deploy even when
// the process itself is healthy.
app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// Readiness/diagnostics probe: reports dependency status, 503 when degraded.
app.get("/health", async (_req, res) => {
    const { ok, checks } = await runHealthChecks();
    res.status(ok ? 200 : 503).json({
        status: ok ? "ok" : "degraded",
        checks,
    });
});

app.use("/api", optionalAuth, globalApiLimiter);

registerRoutes(app);

app.use(errorHandler);

app.listen(Number(PORT), "0.0.0.0", () => {
    logger.info("Server listening", { port: PORT, nodeEnv: env.NODE_ENV });
    logInngestStartupMode();

    // Best-effort startup cleanup; never block listening on maintenance work.
    void cleanupExpiredOAuthNonces().catch((error: unknown) => {
        logger.warn("OAuth nonce cleanup failed at startup", {
            error: error instanceof Error ? error.message : String(error),
        });
    });
    void recoverAbandonedDurableJobs().catch((error: unknown) => {
        logger.warn("Durable job recovery failed at startup", {
            error: error instanceof Error ? error.message : String(error),
        });
    });
});
