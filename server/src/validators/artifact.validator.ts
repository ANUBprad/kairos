import { z } from "zod";
import { workspaceIdParamSchema } from "./workspace.validator.js";

export const artifactTypes = [
    "SUMMARY",
    "TAKEAWAYS",
    "FLASHCARDS",
    "QUIZ",
    "MINDMAP",
    "REPORT",
    "PODCAST",
] as const;


export const artifactIdParamSchema = workspaceIdParamSchema.extend({
    artifactId: z.string().trim().min(1, "Artifact id is required"),
});

export const createArtifactSchema = z.object({
    type: z.enum(artifactTypes),
    title: z.string().trim().min(1).max(120).optional(),
    sourceIds: z.array(z.string().trim().min(1)).optional(),
});

export const podcastInterruptionSchema = z.object({
    question: z.string().trim().min(1, "Question is required").max(2000),
    timestamp: z.number().finite().min(0).max(24 * 60 * 60),
});

export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;