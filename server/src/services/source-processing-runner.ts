import { findChunksBySourceId } from "../repository/source-chunk.repository.js";
import { findSourceById } from "../repository/source.repository.js";
import {
    chunkSourceContent,
    embedAndIndexSource,
    extractSourceContent,
    markSourceFailed,
    markSourceProcessing,
} from "./source-processing.services.js";
import {
    DurableJobLeaseLostError,
    isDurableJobLeaseActiveForJob,
    markDurableJobDelivered,
    releaseDurableJob,
    withDurableJobHeartbeat,
    type DurableJobLeaseContext,
} from "../lib/outbox.js";

/**
 * Full source pipeline without Inngest (extract → chunk → embed).
 * The optional lease token comes from the outbox claim and prevents a stale
 * worker from completing or releasing a reissued job.
 */
export async function processSourceById(
    sourceId: string,
    jobKey?: string,
    leaseToken?: string,
) {
    const lease: DurableJobLeaseContext | undefined =
        jobKey && leaseToken ? { jobKey, leaseToken } : undefined;

    return withDurableJobHeartbeat(jobKey, leaseToken, async () => {
        try {
            await markSourceProcessing(sourceId, lease);

            const extracted = await extractSourceContent(sourceId, lease);
            await chunkSourceContent(
                sourceId,
                extracted.text,
                extracted.pages,
                extracted.source.metadata,
                lease,
            );

            const source = await findSourceById(sourceId);
            if (!source) {
                throw new Error("Source not found");
            }

            const chunks = await findChunksBySourceId(sourceId);
            await embedAndIndexSource(source, chunks, lease);

            if (jobKey) {
                const delivered = await markDurableJobDelivered(jobKey, leaseToken);
                if (!delivered) {
                    throw new DurableJobLeaseLostError(jobKey);
                }
            }
            return { sourceId, status: "READY", chunkCount: chunks.length };
        } catch (error) {
            // Recovery may have reissued the job while this worker was in a
            // slow provider call. A stale worker must not release, fail, or
            // refund work that now belongs to a new lease holder.
            if (
                error instanceof DurableJobLeaseLostError ||
                (jobKey &&
                    leaseToken &&
                    !(await isDurableJobLeaseActiveForJob(jobKey, leaseToken)))
            ) {
                throw error instanceof DurableJobLeaseLostError
                    ? error
                    : new DurableJobLeaseLostError(jobKey!);
            }

            if (jobKey) {
                const released = await releaseDurableJob(jobKey, error, leaseToken);
                // The release CAS is the final authority. A null result means
                // recovery reissued the job while this worker was failing.
                if (released === null) {
                    throw new DurableJobLeaseLostError(jobKey);
                }
            }

            const source = await findSourceById(sourceId);
            if (source) {
                await markSourceFailed(sourceId, error, source.metadata);
            }
            throw error;
        }
    });
}
