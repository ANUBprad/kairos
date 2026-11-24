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
    markDurableJobDelivered,
    releaseDurableJob,
    withDurableJobHeartbeat,
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
    return withDurableJobHeartbeat(jobKey, leaseToken, async () => {
        try {
            await markSourceProcessing(sourceId);

            const extracted = await extractSourceContent(sourceId);
            await chunkSourceContent(
                sourceId,
                extracted.text,
                extracted.pages,
            );

            const source = await findSourceById(sourceId);
            if (!source) {
                throw new Error("Source not found");
            }

            const chunks = await findChunksBySourceId(sourceId);
            await embedAndIndexSource(source, chunks);

            if (jobKey) await markDurableJobDelivered(jobKey, leaseToken);
            return { sourceId, status: "READY", chunkCount: chunks.length };
        } catch (error) {
            if (jobKey) await releaseDurableJob(jobKey, error, leaseToken);

            const source = await findSourceById(sourceId);
            if (source) {
                await markSourceFailed(sourceId, error, source.metadata);
            }
            throw error;
        }
    });
}
