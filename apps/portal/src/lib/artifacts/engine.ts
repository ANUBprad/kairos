import { randomUUID } from "node:crypto";
import type { ArtifactType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/providers";
import { formatForProvider } from "@/lib/ai/prompts";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { requireSession } from "@/lib/server/auth-utils";
import { createTrace, finishTrace } from "@/lib/observability/trace-explorer";
import { AppError, logError, sanitizeError } from "@/lib/errors";
import { getStorageProvider } from "@/lib/storage";
import { generatePodcastAudio } from "@/lib/audio/pipeline";
import {
  normalizeArtifactSourceIds,
  assertNonEmptySourceScope,
  assertSourcesOwned,
  createLearningArtifact,
  getLearningArtifactInKb,
  updateLearningArtifactStatus,
  completeLearningArtifact,
  failLearningArtifact,
  type LearningArtifactData,
} from "@/lib/artifacts";
import type { ProviderType } from "@/lib/ai/types";
import type { PodcastArtifactOutput } from "./podcast";
import { resolveArtifactDefinition } from "./definitions";
import { parseStructuredOutput } from "./output";
import { loadArtifactSourceChunks, buildBoundedContext } from "./context";
import { buildArtifactTraceMetadata } from "./observability";

export interface GenerateArtifactRequest {
  knowledgeBaseId: string;
  artifactType: ArtifactType;
  sourceIds: string[];
  name?: string;
  model?: string;
  providerType?: ProviderType;
  // Lineage: the id of the artifact this one was regenerated from, surfaced in
  // the artifact's own metadata so history lives beside the data with no
  // schema change (roadmap convention, not a versioning model).
  parentArtifactId?: string;
}

export async function getKbOrganizationId(kbId: string): Promise<string | null> {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: { project: { select: { organizationId: true } } },
  });
  return kb?.project.organizationId ?? null;
}

// Authenticated entrypoint for server actions / route handlers calling from a
// user session.
export async function generateLearningArtifact(
  request: GenerateArtifactRequest,
): Promise<LearningArtifactData> {
  const session = await requireSession();
  return generateLearningArtifactForUser({ ...request, userId: session.user.id });
}

// Core generation for an explicitly identified user (future job/queue paths
// pass through here). Synchronous: create (PENDING) -> PROCESSING -> either
// COMPLETED with the validated payload or FAILED, and always traced.
export async function generateLearningArtifactForUser(
  request: GenerateArtifactRequest & { userId: string },
): Promise<LearningArtifactData> {
  const { userId, knowledgeBaseId, artifactType } = request;

  const provider = getAIProvider(request.providerType);
  const definition = resolveArtifactDefinition(artifactType);

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }

  const normalized = normalizeArtifactSourceIds(request.sourceIds);
  assertNonEmptySourceScope(normalized);

  const scopedDocs = await prisma.document.findMany({
    where: { id: { in: normalized }, knowledgeBaseId },
    select: { id: true },
  });
  assertSourcesOwned(normalized, new Set(scopedDocs.map((d) => d.id)));

  const artifact = await createLearningArtifact({
    knowledgeBaseId,
    type: artifactType,
    sourceIds: normalized,
    name: request.name,
    schemaVersion: definition.schemaVersion,
    createdById: userId,
    metadata: request.parentArtifactId
      ? ({ parentArtifactId: request.parentArtifactId } as Prisma.InputJsonValue)
      : undefined,
  });
  await updateLearningArtifactStatus(artifact.id, "PROCESSING");

  let startedTrace: Awaited<ReturnType<typeof createTrace>> | null = null;
  let uploadedAudioKey: string | null = null;

  try {
    const organizationId = await getKbOrganizationId(knowledgeBaseId);
    const model = request.model ?? provider.getDefaultModel();
    startedTrace = organizationId
      ? await createTrace(organizationId, {
          requestId: randomUUID(),
          name: `artifact.generate.${artifactType.toLowerCase()}`,
          provider: provider.type,
          model,
          metadata: buildArtifactTraceMetadata({
            artifactId: artifact.id,
            knowledgeBaseId,
            sourceIds: normalized,
            artifactType,
          }),
          userId,
        })
      : null;

    const chunks = await loadArtifactSourceChunks(knowledgeBaseId, normalized);
    const bounded = buildBoundedContext(chunks, definition.contextTokenBudget);
    if (bounded.context === "") {
      throw new AppError(
        "ARTIFACT_CONTEXT_EMPTY",
        "No usable source content found for the selected sources",
        400,
      );
    }

    const messages = formatForProvider(
      [
        { role: "system", content: definition.buildSystemPrompt() },
        { role: "user", content: definition.buildUserPrompt(bounded.context) },
      ],
      provider.type,
    );

    const response = await provider.generateChat({
      model,
      messages,
      ...(definition.temperature !== undefined ? { temperature: definition.temperature } : {}),
    });

    const parsed = parseStructuredOutput(definition.outputSchema, response.content);
    if (!parsed.ok) {
      throw new AppError("ARTIFACT_SCHEMA_ERROR", "Generated content did not match the artifact schema", 502);
    }

    // PODCAST additionally produces media: each turn is synthesized and the
    // episode is stored as authenticated audio. Any failure here fails the
    // whole artifact atomically — no partial podcast is ever completed.
    let audioMetadata: Record<string, unknown> | undefined;
    if (artifactType === "PODCAST") {
      const podcastContent = parsed.data as unknown as PodcastArtifactOutput;
      const synthesized = await generatePodcastAudio({ turns: podcastContent.turns });
      const storageFile = await getStorageProvider().upload(
        synthesized.audio,
        `${artifactType.toLowerCase()}.${synthesized.format}`,
        `artifacts/${artifactType.toLowerCase()}-${artifact.id}`,
        { accessMode: "authenticated" },
      );
      uploadedAudioKey = storageFile.key;
      audioMetadata = {
        provider: synthesized.provider,
        storageProvider: storageFile.provider,
        storageKey: storageFile.key,
        format: synthesized.format,
        durationSeconds: synthesized.durationSeconds,
      };
    }

    const completed = await completeLearningArtifact(
      artifact.id,
      parsed.data as unknown as Prisma.InputJsonValue,
      {
        metadata: {
          promptVersion: definition.promptVersion,
          providerType: provider.type,
          model: response.model,
          ...(audioMetadata ? { audio: audioMetadata as Prisma.InputJsonValue } : {}),
          ...(request.parentArtifactId
            ? { parentArtifactId: request.parentArtifactId }
            : {}),
        } as Prisma.InputJsonValue,
        schemaVersion: definition.schemaVersion,
      },
    );

    if (startedTrace) {
      await finishTrace(startedTrace.id, {
        status: "OK",
        inputTokens: response.usage?.promptTokens,
        outputTokens: response.usage?.completionTokens,
        totalTokens: response.usage?.totalTokens,
      });
    }
    return completed;
  } catch (error) {
    if (uploadedAudioKey) {
      try {
        await getStorageProvider().delete(uploadedAudioKey);
      } catch (cleanupError) {
        logError("artifact.engine.cleanup", cleanupError, { artifactId: artifact.id, audioKey: uploadedAudioKey });
      }
    }
    if (startedTrace) {
      try {
        await finishTrace(startedTrace.id, { status: "ERROR" });
      } catch (traceError) {
        logError("artifact.engine.trace", traceError, { artifactId: artifact.id });
      }
    }
    try {
      await failLearningArtifact(artifact.id, sanitizeError(error).message);
    } catch (failError) {
      logError("artifact.engine.fail", failError, { artifactId: artifact.id });
    }
    logError("artifact.engine.generate", error, {
      artifactId: artifact.id,
      artifactType,
      knowledgeBaseId,
    });
    if (error instanceof AppError) throw error;
    throw new AppError("ARTIFACT_GENERATION_FAILED", "Artifact generation failed", 502);
  }
}

// Authenticated entrypoint for regeneration from a server action.
export async function regenerateLearningArtifact(request: {
  knowledgeBaseId: string;
  artifactId: string;
}): Promise<LearningArtifactData> {
  const session = await requireSession();
  return regenerateLearningArtifactForUser(session.user.id, request);
}

// Core regeneration for an explicitly identified user. The caller passes only
// the knowledge base and the id it wants regenerated — the source scope and
// type come from the stored row, never from the browser, and ownership is
// revalidated before any new artifact exists. The original is never mutated:
// success or failure both leave it untouched, and a brand-new artifact row
// captures the result with parentArtifactId lineage in its metadata.
export async function regenerateLearningArtifactForUser(
  userId: string,
  request: { knowledgeBaseId: string; artifactId: string },
): Promise<LearningArtifactData> {
  const { knowledgeBaseId, artifactId } = request;

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }

  const original = await getLearningArtifactInKb(artifactId, knowledgeBaseId);
  if (!original) {
    // A foreign or unknown artifact id resolves to the same safe failure —
    // no existence leak across KB tenancies.
    throw new AppError("NOT_FOUND", "Artifact not found", 404);
  }

  if (original.status === "PENDING" || original.status === "PROCESSING") {
    throw new AppError(
      "ARTIFACT_IN_PROGRESS",
      "The artifact is still being generated",
      409,
    );
  }

  return generateLearningArtifactForUser({
    userId,
    knowledgeBaseId: original.knowledgeBaseId,
    artifactType: original.type,
    sourceIds: original.sourceIds,
    name: original.name ?? undefined,
    parentArtifactId: original.id,
  });
}