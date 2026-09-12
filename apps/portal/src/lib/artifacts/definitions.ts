import type { ArtifactType } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { summaryArtifactDefinition } from "./summary";

export interface ArtifactDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  type: ArtifactType;
  schemaVersion: number;
  promptVersion: string;
  temperature?: number;
  contextTokenBudget: number;
  outputSchema: S;
  buildSystemPrompt(): string;
  buildUserPrompt(contextText: string): string;
}

const registry = new Map<ArtifactType, ArtifactDefinition>();

export function registerArtifactDefinition(definition: ArtifactDefinition): void {
  registry.set(definition.type, definition);
}

export function resolveArtifactDefinition(type: ArtifactType): ArtifactDefinition {
  const definition = registry.get(type);
  if (!definition) {
    throw new AppError(
      "UNSUPPORTED_ARTIFACT_TYPE",
      `No generation definition registered for artifact type: ${type}`,
      400,
    );
  }
  return definition;
}

export function listRegisteredArtifactTypes(): ArtifactType[] {
  return [...registry.keys()];
}

registerArtifactDefinition(summaryArtifactDefinition);