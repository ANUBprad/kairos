import { createApp } from "./app.js";
import { cleanupExpiredOAuthNonces } from "./lib/oauth-state.js";
import { recoverAbandonedDurableJobs } from "./lib/outbox.js";
import { createDurableJobSweeper } from "./lib/job-sweeper.js";
import { logInngestStartupMode } from "./inngest/config.js";
import { assertServerEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";

const env = assertServerEnv();
const app = createApp();
const PORT = env.PORT;

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

    // Startup recovery runs once; the periodic sweeper guarantees that jobs
    // committed just before a crash are still drained without a restart.
    createDurableJobSweeper().start();
});
