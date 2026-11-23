/**
 * Inngest event helpers for background artifact generation.
 */

import { sendInngestEvent } from "./inngest-send.js";

/**
 * Enqueues an artifact generation job to run asynchronously via Inngest.
 *
 * The event id is the durable job key so Inngest deduplicates redeliveries.
 *
 * @param input - Artifact and workspace ids for the worker
 * @returns `true` when Inngest accepted the event; `false` when the caller
 * should run the job in-process.
 */
export async function enqueueArtifactGeneration(input: {
    artifactId: string;
    workspaceId: string;
    jobKey?: string;
}): Promise<boolean> {
    const jobKey = input.jobKey ?? `artifact-generate:${input.artifactId}`;
    return sendInngestEvent({
        id: jobKey,
        name: "artifact/generate",
        data: { ...input, jobKey },
    });
}
