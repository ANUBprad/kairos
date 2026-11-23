/**
 * Inngest event helpers for background artifact generation.
 */

import { sendInngestEvent } from "./inngest-send.js";

/**
 * Enqueues an artifact generation job to run asynchronously via Inngest.
 *
 * @param input - Artifact and workspace ids for the worker
 * @returns `true` when Inngest accepted the event; `false` when the caller
 * should run the job in-process.
 */
export async function enqueueArtifactGeneration(input: {
    artifactId: string;
    workspaceId: string;
}): Promise<boolean> {
    return sendInngestEvent({
        name: "artifact/generate",
        data: input,
    });
}
