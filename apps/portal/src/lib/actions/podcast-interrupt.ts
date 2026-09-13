"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generatePodcastInterruption } from "@/lib/artifacts/interrupt-service";
import { toWorkspaceInterruptionView } from "@/lib/artifacts/interrupt-view";
import type { PodcastInterruptionView } from "@/lib/artifacts/interrupt-view";

// Application contract for the podcast Ask flow. Rate limiting runs here,
// before any model or speech spend; the engine performs validation,
// authorization, grounding, generation, synthesis and secure persistence; the
// returned view is the client-safety projection that never carries storage
// references. All database access happens below through the artifact layer.
export async function askPodcastInterruption(
  artifactId: string,
  knowledgeBaseId: string,
  question: string,
): Promise<PodcastInterruptionView> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const rl = rateLimit(`podcast-interrupt:${session.user.id}`, RATE_LIMITS.podcastInterrupt);
  if (!rl.allowed) {
    throw new Error("Rate limit exceeded. Please wait a minute before asking again.");
  }

  return toWorkspaceInterruptionView(
    await generatePodcastInterruption({ artifactId, knowledgeBaseId, question }),
  );
}