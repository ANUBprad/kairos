import { randomUUID } from "node:crypto";
import type { ArtifactType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/providers";
import { formatForProvider } from "@/lib/ai/prompts";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { requireSession } from "@/lib/server/auth-utils";
import { createTrace, finishTrace } from "@/lib/observability/trace-explorer";
import { AppError, logError, sanitizeError } from "@/lib/errors";
import {
  normalizeArtifactSourceIds,
  assertNonEmptySourceScope,
  assertSourcesOwned,
  createLearningArtifact,
  updateLearningArtifactStatus,
  completeLearningArtifact,
  failLearningArtifact,
  type LearningArtifactData,
} from "@/lib/artifacts";
import type { ProviderType } from "@/lib/ai/types";
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
}

async function getKbOrganizationId(kbId: string): Promise<string | null> {
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
  });
  await updateLearningArtifactStatus(artifact.id, "PROCESSING");

  const organizationId = await getKbOrganizationId(knowledgeBaseId);
  const model = request.model ?? provider.getDefaultModel();
  const startedTrace = organizationId
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

  try {
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

    const completed = await completeLearningArtifact(
      artifact.id,
      parsed.data as unknown as Prisma.InputJsonValue,
      {
        metadata: {
          promptVersion: definition.promptVersion,
          providerType: provider.type,
          model: response.model,
        },
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