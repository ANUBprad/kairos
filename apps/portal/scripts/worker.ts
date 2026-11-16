// Standalone durable-processing worker. Run at least one alongside the portal
// so queued documents finish even when no browser request is alive:
//   npm run worker
// The process is safe to kill: an interrupted job keeps its RUNNING lock and is
// requeued by the next worker's stale-job recovery pass.
import { runProcessingWorker } from "@/lib/ingestion/queue";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const controller = new AbortController();

function stop(signal: NodeJS.Signals) {
  if (controller.signal.aborted) return;
  logger.info("Processing worker received shutdown signal", { signal });
  controller.abort();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

runProcessingWorker({ signal: controller.signal })
  .catch((error) => {
    logger.error("Processing worker crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
