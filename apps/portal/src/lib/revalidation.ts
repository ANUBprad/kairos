import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

/**
 * Invalidates the KB-scoped sources page after a background pipeline terminal
 * transition (INDEXED / ERROR / revert-to-INDEXED).
 *
 * The embedding pipeline runs fire-and-forget, so by the time it finishes the
 * spawning server action may already be gone: Next.js then has no request
 * scope and `revalidatePath` raises a store invariant instead of revalidating.
 * Revalidation here is best-effort — when a request scope exists it purges the
 * cached route; otherwise we keep current behavior rather than corrupt the
 * pipeline's authoritative state transition.
 */
export function revalidateSourcePage(kbId: string | null | undefined): void {
  if (!kbId) return;
  try {
    revalidatePath(`/app/knowledge-bases/${kbId}`);
  } catch (err) {
    logger.debug("Source page revalidation skipped (no active request)", {
      kbId,
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
}