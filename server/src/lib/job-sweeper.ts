import { recoverAbandonedDurableJobs } from "./outbox.js";
import { logger } from "./logger.js";

export const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

export interface DurableJobSweeper {
    /** Runs one bounded sweep. Overlapping ticks are skipped, never queued. */
    tick(): Promise<number>;
    start(): void;
    stop(): void;
    readonly running: boolean;
}

/**
 * Periodic recovery for persisted outbox work.
 *
 * Startup recovery alone is insufficient: a job can be committed and then the
 * process can die before dispatch, leaving it PENDING until the next restart.
 * A bounded periodic sweep guarantees eventual processing. The interval timer
 * is unref'd so it never keeps a test or short-lived process alive.
 */
export function createDurableJobSweeper(
    intervalMs: number = DEFAULT_SWEEP_INTERVAL_MS,
): DurableJobSweeper {
    if (!Number.isInteger(intervalMs) || intervalMs < 1000) {
        throw new Error("Sweep interval must be at least 1000 ms");
    }

    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function tick(): Promise<number> {
        if (inFlight) return 0;
        inFlight = true;
        try {
            // recoverAbandonedDurableJobs reclaims stale PROCESSING jobs and
            // also dispatches a bounded batch of due PENDING jobs.
            return await recoverAbandonedDurableJobs();
        } catch (error) {
            logger.warn("Durable job sweep failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        } finally {
            inFlight = false;
        }
    }

    return {
        tick,
        start(): void {
            if (timer) return;
            timer = setInterval(() => {
                void tick();
            }, intervalMs);
            // Never hold the event loop open solely for maintenance work.
            timer.unref?.();
        },
        stop(): void {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }
        },
        get running(): boolean {
            return inFlight;
        },
    };
}
