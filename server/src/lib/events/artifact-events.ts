/**
 * Inngest event helpers for background artifact generation.
 */

import { getRequestId } from "../observability/request-context.js";
import { sendInngestEvent } from "./inngest-send.js";

/**
 * Enqueues an artifact generation job to run asynchronously via Inngest.
 *
 * The durable outbox supplies a per-claim `eventId` (derived from the lease
 * token) so Inngest dedupes redeliveries without suppressing a legitimate
 * retry; direct legacy callers fall back to the job key.
 *
 * @param input - Artifact and workspace ids for the worker
 * @returns `true` when Inngest accepted the event; `false` when the caller
 * should run the job in-process.
 */
export async function enqueueArtifactGeneration(input: {
    artifactId: string;
    workspaceId: string;
    jobKey?: string;
    leaseToken?: string;
    eventId?: string;
    requestId?: string;
}): Promise<boolean> {
    const jobKey = input.jobKey ?? `artifact-generate:${input.artifactId}`;
    return sendInngestEvent({
        id: input.eventId ?? jobKey,
        name: "artifact/generate",
        data: { ...input, jobKey, requestId: getRequestId() },
    });
}
