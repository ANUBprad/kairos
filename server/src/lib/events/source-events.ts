import { logger } from "../logger.js";
import { sendInngestEvent } from "./inngest-send.js";

/**
 * Enqueues a source processing job to run asynchronously via Inngest.
 *
 * The worker runs extract → chunk → embed → Pinecone upsert.
 *
 * @param input - Source and workspace ids for the processing worker
 * @returns `true` when Inngest accepted the event; `false` when the caller
 * should run the job in-process.
 */
export async function enqueueSourceProcessing(input: {
    sourceId: string;
    workspaceId: string;
}): Promise<boolean> {
    return sendInngestEvent({
        name: "source/created",
        data: input,
    });
}

/** Runs source processing in-process when Inngest is unavailable. */
export function runSourceProcessingFallback(input: {
    sourceId: string;
    workspaceId: string;
}): void {
    void import("../../services/source-processing-runner.js")
        .then(({ processSourceById }) => processSourceById(input.sourceId))
        .catch((err) => {
            logger.error("Source processing failed", { sourceId: input.sourceId, err });
        });
}
