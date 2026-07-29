"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import {
  createReview,
  getReview,
  listReviews,
  assignReview,
  startReview,
  approveReview,
  rejectReview,
  markNeedsImprovement,
  addComment,
  getReviewStats,
  getMyReviews,
  getReviewHistory,
  type CreateReviewInput,
} from "@/lib/review-queue";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import type { ReviewStatus, ReviewPriority } from "@prisma/client";

const ORG_ID = "demo-org";

// ============================================================================
// Review Item Actions
// ============================================================================

export async function createReviewItem(input: CreateReviewInput) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const review = await createReview(ORG_ID, session.user.id, input);

    revalidatePath("/app/reviews");
    return { success: true, review };
  } catch (error) {
    logger.error("Failed to create review item", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create review item",
    };
  }
}

export async function getReviewItem(reviewId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const review = await getReview(reviewId);

    return { success: true, review };
  } catch (error) {
    logger.error("Failed to get review item", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get review item",
    };
  }
}

export async function listReviewItems(options: {
  status?: ReviewStatus;
  assigneeId?: string;
  resourceType?: string;
  priority?: ReviewPriority;
  limit?: number;
  offset?: number;
} = {}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const result = await listReviews(ORG_ID, options);

    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to list review items", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list review items",
    };
  }
}

export async function assignReviewItem(reviewId: string, assigneeId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const review = await assignReview(reviewId, assigneeId);

    revalidatePath("/app/reviews");
    return { success: true, review };
  } catch (error) {
    logger.error("Failed to assign review item", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assign review item",
    };
  }
}

export async function startReviewItem(reviewId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const review = await startReview(reviewId, session.user.id);

    revalidatePath("/app/reviews");
    return { success: true, review };
  } catch (error) {
    logger.error("Failed to start review item", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start review item",
    };
  }
}

export async function approveReviewItem(reviewId: string, score?: number) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const review = await approveReview(reviewId, session.user.id, score);

    revalidatePath("/app/reviews");
    return { success: true, review };
  } catch (error) {
    logger.error("Failed to approve review item", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve review item",
    };
  }
}

export async function rejectReviewItem(reviewId: string, reason?: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const review = await rejectReview(reviewId, session.user.id, reason);

    revalidatePath("/app/reviews");
    return { success: true, review };
  } catch (error) {
    logger.error("Failed to reject review item", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject review item",
    };
  }
}

export async function markReviewNeedsImprovement(reviewId: string, comments: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const review = await markNeedsImprovement(reviewId, session.user.id, comments);

    revalidatePath("/app/reviews");
    return { success: true, review };
  } catch (error) {
    logger.error("Failed to mark review as needs improvement", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark review as needs improvement",
    };
  }
}

export async function addReviewComment(reviewId: string, content: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const comment = await addComment(reviewId, session.user.id, content);

    revalidatePath("/app/reviews");
    return { success: true, comment };
  } catch (error) {
    logger.error("Failed to add review comment", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add review comment",
    };
  }
}

export async function getReviewItemStats() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const stats = await getReviewStats(ORG_ID);

    return { success: true, stats };
  } catch (error) {
    logger.error("Failed to get review stats", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get review stats",
    };
  }
}

export async function getMyReviewItems(options: {
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
} = {}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const result = await getMyReviews(session.user.id, options);

    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to get my review items", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get my review items",
    };
  }
}

export async function getReviewItemHistory(resourceType: string, resourceId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const history = await getReviewHistory(resourceType, resourceId);

    return { success: true, history };
  } catch (error) {
    logger.error("Failed to get review history", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get review history",
    };
  }
}
