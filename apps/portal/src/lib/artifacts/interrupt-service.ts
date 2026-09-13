import { randomUUID } from "node:crypto";
import { getAIProvider } from "@/lib/ai/providers";
import { formatForProvider } from "@/lib/ai/prompts";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { requireSession } from "@/lib/server/auth-utils";
import { addSpan, createTrace, finishSpan, finishTrace } from "@/lib/observability/trace-explorer";
import { AppError, logError } from "@/lib/errors";
import { getStorageProvider } from "@/lib/storage";
import { generatePodcastAudio } from "@/lib/audio/pipeline";
import { getTTSProvider } from "@/lib/audio/providers";
import type { ProviderType } from "@/lib/ai/types";
import { parseStructuredOutput } from "./output";
import { loadArtifactSourceChunks, buildBoundedContext } from "./context";
import { getLearningArtifactInKb, appendPodcastInterruption } from "./persistence";
import { getKbOrganizationId } from "./engine";
import {
  buildPodcastInterruptSystemPrompt,
  buildPodcastInterruptUserPrompt,
  parseInterruptionQuestion,
  podcastInterruptSchema,
  PODCAST_INTERRUPT_CONTEXT_TOKEN_BUDGET,
  PODCAST_INTERRUPT_PROMPT_VERSION,
  PODCAST_INTERRUPT_TEMPERATURE,
  type PodcastInterruptOutput,
  type PodcastInterruptionRecord,
} from "./interrupt";

export interface GeneratePodcastInterruptionRequest {
  artifactId: string;
  knowledgeBaseId: string;
  question: string;
  model?: string;
  providerType?: ProviderType;
}

// Authenticated entrypoint for the Ask flow. The action pins the rate limit;
// everything else — validation, authorization, grounding, generation, synthesis,
// secure storage and bounded persistence — lives in the shared service so any
// future caller cannot bypass any stage.
export async function generatePodcastInterruption(
  request: GeneratePodcastInterruptionRequest,
): Promise<PodcastInterruptionRecord> {
  const session = await requireSession();
  return generatePodcastInterruptionForUser({ ...request, userId: session.user.id });
}

export async function generatePodcastInterruptionForUser(
  request: GeneratePodcastInterruptionRequest & { userId: string },
): Promise<PodcastInterruptionRecord> {
  const { userId, artifactId, knowledgeBaseId } = request;
  const question = parseInterruptionQuestion(request.question);

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Podcast not found", 404);
  }

  // The podcast's persisted row is the authoritative tenant boundary: a
  // foreign artifact resolves to "not found", never a 403 that leaks its
  // existence, and the grounding scope is taken from the row, not the client.
  const artifact = await getLearningArtifactInKb(artifactId, knowledgeBaseId);
  if (!artifact || artifact.type !== "PODCAST") {
    throw new AppError("NOT_FOUND", "Podcast not found", 404);
  }
  if (artifact.status !== "COMPLETED") {
    throw new AppError(
      "PODCAST_NOT_COMPLETED",
      "The podcast must finish generating before you can interrupt it",
      409,
    );
  }

  const provider = getAIProvider(request.providerType);
  const model = request.model ?? provider.getDefaultModel();
  const ttsProvider = getTTSProvider();
  const interruptionId = randomUUID();

  const organizationId = await getKbOrganizationId(artifact.knowledgeBaseId);
  const trace = organizationId
    ? await createTrace(organizationId, {
        requestId: randomUUID(),
        name: "artifact.podcast.interrupt",
        provider: provider.type,
        model,
        metadata: {
          artifactId: artifact.id,
          knowledgeBaseId: artifact.knowledgeBaseId,
          interruptionId,
          sourceIds: [...artifact.sourceIds],
          promptVersion: PODCAST_INTERRUPT_PROMPT_VERSION,
          questionLength: question.length,
          ttsProvider: ttsProvider.type,
        },
        userId,
      })
    : null;

  let uploadedStorageKey: string | null = null;

  try {
    const chunks = await loadArtifactSourceChunks(artifact.knowledgeBaseId, artifact.sourceIds);
    const bounded = buildBoundedContext(chunks, PODCAST_INTERRUPT_CONTEXT_TOKEN_BUDGET);
    if (bounded.context === "") {
      throw new AppError(
        "ARTIFACT_CONTEXT_EMPTY",
        "The sources behind this podcast are not available for questions",
        400,
      );
    }

    const messages = formatForProvider(
      [
        { role: "system", content: buildPodcastInterruptSystemPrompt() },
        { role: "user", content: buildPodcastInterruptUserPrompt(bounded.context, question) },
      ],
      provider.type,
    );

    const generationSpan = trace
      ? await addSpan(trace.id, { name: "podcast.interrupt.generate", startTime: new Date() })
      : null;
    const response = await provider.generateChat({
      model,
      messages,
      temperature: PODCAST_INTERRUPT_TEMPERATURE,
    });
    if (generationSpan) await finishSpan(generationSpan.id);

    const parsed = parseStructuredOutput(podcastInterruptSchema, response.content);
    if (!parsed.ok) {
      throw new AppError("ARTIFACT_SCHEMA_ERROR", "Generated content did not match the interruption schema", 502);
    }
    const output = parsed.data as unknown as PodcastInterruptOutput;

    const ttsSpan = trace
      ? await addSpan(trace.id, { name: "podcast.interrupt.tts", startTime: new Date() })
      : null;
    const synthesized = await generatePodcastAudio({ turns: output.turns, provider: ttsProvider });
    if (ttsSpan) await finishSpan(ttsSpan.id);

    const storageFile = await getStorageProvider().upload(
      synthesized.audio,
      `interruption.${synthesized.format}`,
      `artifacts/podcast-${artifact.id}/interruptions/${interruptionId}`,
      { accessMode: "authenticated" },
    );
    uploadedStorageKey = storageFile.key;

    const record: PodcastInterruptionRecord = {
      id: interruptionId,
      question,
      turns: output.turns,
      createdAt: new Date().toISOString(),
      audio: {
        provider: synthesized.provider,
        storageProvider: storageFile.provider,
        storageKey: storageFile.key,
        format: synthesized.format,
        durationSeconds: synthesized.durationSeconds,
      },
    };

    await appendPodcastInterruption(artifact.id, record);

    if (trace) {
      await finishTrace(trace.id, {
        status: "OK",
        inputTokens: response.usage?.promptTokens,
        outputTokens: response.usage?.completionTokens,
        totalTokens: response.usage?.totalTokens,
      });
    }
    return record;
  } catch (error) {
    if (uploadedStorageKey) {
      try {
        await getStorageProvider().delete(uploadedStorageKey);
      } catch (cleanupError) {
        logError("artifact.interrupt.cleanup", cleanupError, {
          artifactId: artifact.id,
          storageKey: uploadedStorageKey,
        });
      }
    }
    if (trace) {
      try {
        await finishTrace(trace.id, { status: "ERROR" });
      } catch (traceError) {
        logError("artifact.interrupt.trace", traceError, { artifactId: artifact.id });
      }
    }
    logError("artifact.interrupt.generate", error, {
      artifactId: artifact.id,
      knowledgeBaseId: artifact.knowledgeBaseId,
      interruptionId,
    });
    if (error instanceof AppError) throw error;
    throw new AppError("PODCAST_INTERRUPTION_FAILED", "Podcast interruption generation failed", 502);
  }
}