import { findChunksBySourceId } from "../repository/source-chunk.repository.js";
import { findSourceById } from "../repository/source.repository.js";
import {
    DurableJobLeaseLostError,
    isDurableJobLeaseActiveForJob,
    markDurableJobDelivered,
    releaseDurableJob,
    withDurableJobHeartbeat,
    type DurableJobLeaseContext,
} from "../lib/outbox.js";
import { runWithRequestId } from "../lib/observability/request-context.js";
import {
    markArtifactFailed,
    processArtifactById,
} from "../services/artifact.services.js";
import { summarizeConversationById } from "../services/conversation-memory.services.js";
import { chunkSourceContent, embedAndIndexSource, extractSourceContent, markSourceFailed, markSourceProcessing } from "../services/source-processing.services.js";
import { inngest } from "./client.js";


/**
 * Inngest durable function triggered by `source/created`.
 * Coordinates the multi-step ETL pipeline: mark processing -> extract -> chunk -> embed & index in Pinecone.
 */
export const processSource = inngest.createFunction(
  {
      id: "process-source",
      // The durable outbox is the single retry owner. Inngest retries would
      // race the sweeper and could complete a job already reissued to a new
      // lease holder.
      retries: 0,
      triggers: [{ event: "source/created" }],
  },
  async ({ event, step }) => {
      const { sourceId, jobKey, leaseToken, requestId } = event.data as {
          sourceId: string;
          jobKey?: string;
          leaseToken?: string;
          requestId?: string;
      };
      const lease: DurableJobLeaseContext | undefined =
          jobKey && leaseToken ? { jobKey, leaseToken } : undefined;

      return runWithRequestId(requestId, async () =>
        withDurableJobHeartbeat(jobKey, leaseToken, async () => {
          try {
              // STEP 1: mark source as processing {status: "PROCESSING"}.
              // This is inside the try so a refused claim releases the leased
              // job instead of leaving it to expire across repeated sweeps.
              await step.run("mark-processing", () => markSourceProcessing(sourceId, lease));

              // STEP 2: extract the content from the source
              const extracted = await step.run("extract-content", () =>
                  extractSourceContent(sourceId, lease),
              );

              // STEP 3: chunk the extracted content
              await step.run("chunk-content", () =>
                  chunkSourceContent(
                      sourceId,
                      extracted.text,
                      extracted.pages,
                      extracted.source.metadata,
                      lease,
                  ),
              );

              // STEP 4: create vectors and store them in the vector DB
              const result = await step.run("embed-and-index", async () => {
                  const source = await findSourceById(sourceId);
                  if (!source) {
                      throw new Error("Source not found");
                  }

                  const chunks = await findChunksBySourceId(sourceId);
                  await embedAndIndexSource(source, chunks, lease);

                  return { chunkCount: chunks.length };
              });

              if (jobKey) {
                  const delivered = await markDurableJobDelivered(jobKey, leaseToken);
                  if (!delivered) {
                      throw new DurableJobLeaseLostError(jobKey);
                  }
              }
              return { sourceId, status: "READY", ...result };
          } catch (error) {
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
                  // A null release means recovery reissued the job first; this
                  // worker must not fail or refund someone else's attempt.
                  if (released === null) {
                      throw new DurableJobLeaseLostError(jobKey);
                  }
              }
              await step.run("mark-failed", async () => {
                  const source = await findSourceById(sourceId);
                  if (source) {
                      await markSourceFailed(sourceId, error, source.metadata);
                  }
              });
              throw error;
          }
        }),
      );
  },
);

/**
 * Inngest durable function triggered by `conversation/summarize`.
 * Produces rolling summaries of long conversations and syncs user memory to Mem0.
 */
export const summarizeConversation = inngest.createFunction(
    {
        id: "summarize-conversation",
        retries: 2,
        triggers: [{ event: "conversation/summarize" }],
    },
    async ({ event, step }) => {
        const { conversationId, userId, requestId } = event.data as {
            conversationId: string;
            userId: string;
            requestId?: string;
        };

        return runWithRequestId(requestId, async () => {
            await step.run("summarize", () =>
                summarizeConversationById(conversationId, userId),
            );

            return { conversationId, status: "SUMMARIZED" };
        });
    },
);

/**
 * Inngest durable function triggered by `artifact/generate`.
 * Runs AI synthesis for study artifacts (quizzes, flashcards, mind maps, podcasts).
 */
export const generateArtifact = inngest.createFunction(
    {
        id: "generate-artifact",
        // Retries are owned by the durable outbox (see process-source above).
        retries: 0,
        triggers: [{ event: "artifact/generate" }],
    },
    async ({ event, step }) => {
        const { artifactId, jobKey, leaseToken, requestId } = event.data as {
            artifactId: string;
            jobKey?: string;
            leaseToken?: string;
            requestId?: string;
        };

        return runWithRequestId(requestId, async () => {
            try {
                await step.run("generate", () =>
                    processArtifactById(artifactId, jobKey, leaseToken),
                );
                return { artifactId, status: "READY" };
            } catch (error) {
                // processArtifactById already releases and marks the artifact
                // failed; this is an idempotent, lease-guarded safety net.
                if (jobKey) {
                    await releaseDurableJob(jobKey, error, leaseToken);
                }
                await step.run("mark-failed", async () => {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Artifact generation failed";
                    await markArtifactFailed(artifactId, message);
                });
                throw error;
            }
        });
    },
);

export const functions = [processSource, summarizeConversation, generateArtifact];
