import { logger } from "../logger.js";
import { sendInngestEvent } from "./inngest-send.js";

/**
 * Enqueues a source processing job to run asynchronously via Inngest.
 *
 * The worker runs extract → chunk → embed → Pinecone upsert. The event id is
 * the durable job key so Inngest deduplicates redeliveries.
 *
 * @param input - Source and workspace ids for the processing worker
 * @returns `true` when Inngest accepted the event; `false` when the caller
 * should run the job in-process.
 */
export async function enqueueSourceProcessing(input: {
    sourceId: string;
    workspaceId: string;
    title?: string;
    jobKey?: string;
}): Promise<boolean> {
    const jobKey = input.jobKey ?? `source.process:${input.sourceId}`;
    return sendInngestEvent({
        id: jobKey,
        name: "source/created",
        data: { ...input, jobKey },
    });
}

/**
 * Runs source processing in-process when Inngest is unavailable. Prefer the
 * durable outbox dispatcher; this fallback exists for legacy direct callers.
 */
export function runSourceProcessingFallback(input: {
    sourceId: string;
    workspaceId: string;
    jobKey?: string;
}): void {
    void import("../../services/source-processing-runner.js")
        .then(({ processSourceById }) =>
            processSourceById(input.sourceId, input.jobKey),
        )
        .catch((err) => {
            logger.error("Source processing failed", { sourceId: input.sourceId, err });
        });
}
