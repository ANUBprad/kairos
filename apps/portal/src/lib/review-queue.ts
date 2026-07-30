/**
 * Human Review Queue for Kairos Enterprise
 *
 * Provides review item management, assignment, status transitions,
 * commenting, and statistics for human-in-the-loop review workflows.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma, ReviewStatus, ReviewPriority } from "@prisma/client";

export interface ReviewQueueInfo {
  id: string;
  title: string;
  description: string | null;
  status: ReviewStatus;
  priority: ReviewPriority;
  score: number | null;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  organizationId: string;
  assigneeId: string | null;
  createdById: string;
  reviewerId: string | null;
  reviewedAt: Date | null;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewCommentInfo {
  id: string;
  content: string;
  reviewId: string;
  authorId: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewInput {
  title: string;
  description?: string;
  resourceType: string;
  resourceId: string;
  priority?: ReviewPriority;
  assigneeId?: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewDecision {
  status: ReviewStatus;
  score?: number;
  reason?: string;
}

function mapReview(
  review: {
    id: string;
    title: string;
    description: string | null;
    status: ReviewStatus;
    priority: ReviewPriority;
    score: number | null;
    resourceType: string;
    resourceId: string;
    metadata: unknown;
    organizationId: string;
    assigneeId: string | null;
    createdById: string;
    reviewerId: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  commentCount: number = 0
): ReviewQueueInfo {
  return {
    id: review.id,
    title: review.title,
    description: review.description,
    status: review.status,
    priority: review.priority,
    score: review.score,
    resourceType: review.resourceType,
    resourceId: review.resourceId,
    metadata: review.metadata as Record<string, unknown> | null,
    organizationId: review.organizationId,
    assigneeId: review.assigneeId,
    createdById: review.createdById,
    reviewerId: review.reviewerId,
    reviewedAt: review.reviewedAt,
    commentCount,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

async function getReviewOrThrow(reviewId: string) {
  const review = await prisma.reviewQueue.findUnique({
    where: { id: reviewId },
    include: {
      _count: { select: { comments: true } },
    },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  return review;
}

export async function createReview(
  organizationId: string,
  userId: string,
  input: CreateReviewInput
): Promise<ReviewQueueInfo> {
  const review = await prisma.reviewQueue.create({
    data: {
      title: input.title,
      description: input.description,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      priority: input.priority ?? "NORMAL",
      assigneeId: input.assigneeId,
      organizationId,
      createdById: userId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    include: {
      _count: { select: { comments: true } },
    },
  });

  logger.info("Review created", {
    reviewId: review.id,
    organizationId,
    createdBy: userId,
    resourceType: input.resourceType,
  });

  return mapReview(review, (review as { _count?: { comments: number } })._count?.comments ?? 0);
}

export async function getReview(
  reviewId: string
): Promise<(ReviewQueueInfo & { comments: ReviewCommentInfo[] }) | null> {
  const review = await prisma.reviewQueue.findUnique({
    where: { id: reviewId },
    include: {
      comments: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!review) return null;

  return {
    ...mapReview(review, review.comments.length),
    comments: review.comments.map((c) => ({
      id: c.id,
      content: c.content,
      reviewId: c.reviewId,
      authorId: c.authorId,
      author: c.author,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
}

export async function listReviews(
  organizationId: string,
  options: {
    status?: ReviewStatus;
    assigneeId?: string;
    resourceType?: string;
    priority?: ReviewPriority;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ reviews: ReviewQueueInfo[]; total: number }> {
  const { status, assigneeId, resourceType, priority, limit = 20, offset = 0 } = options;

  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;
  if (assigneeId) where.assigneeId = assigneeId;
  if (resourceType) where.resourceType = resourceType;
  if (priority) where.priority = priority;

  const [reviews, total] = await Promise.all([
    prisma.reviewQueue.findMany({
      where,
      include: {
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.reviewQueue.count({ where }),
  ]);

  return {
    reviews: reviews.map((r) => mapReview(r, r._count.comments)),
    total,
  };
}

export async function assignReview(
  reviewId: string,
  assigneeId: string
): Promise<ReviewQueueInfo> {
  const review = await getReviewOrThrow(reviewId);

  const updated = await prisma.reviewQueue.update({
    where: { id: reviewId },
    data: {
      assigneeId,
      status: review.status === "PENDING" ? "PENDING" : review.status,
    },
    include: {
      _count: { select: { comments: true } },
    },
  });

  logger.info("Review assigned", {
    reviewId,
    assigneeId,
    previousAssignee: review.assigneeId,
  });

  return mapReview(updated, updated._count.comments);
}

export async function startReview(
  reviewId: string,
  reviewerId: string
): Promise<ReviewQueueInfo> {
  const review = await getReviewOrThrow(reviewId);

  if (review.status !== "PENDING") {
    throw new Error(`Cannot start review in "${review.status}" status`);
  }

  const updated = await prisma.reviewQueue.update({
    where: { id: reviewId },
    data: {
      status: "IN_REVIEW",
      reviewerId,
      assigneeId: review.assigneeId ?? reviewerId,
    },
    include: {
      _count: { select: { comments: true } },
    },
  });

  logger.info("Review started", { reviewId, reviewerId });

  return mapReview(updated, updated._count.comments);
}

export async function approveReview(
  reviewId: string,
  reviewerId: string,
  score?: number
): Promise<ReviewQueueInfo> {
  const review = await getReviewOrThrow(reviewId);

  if (review.status !== "IN_REVIEW") {
    throw new Error(`Cannot approve review in "${review.status}" status`);
  }

  const updated = await prisma.reviewQueue.update({
    where: { id: reviewId },
    data: {
      status: "APPROVED",
      reviewerId,
      score: score ?? null,
      reviewedAt: new Date(),
    },
    include: {
      _count: { select: { comments: true } },
    },
  });

  logger.info("Review approved", {
    reviewId,
    reviewerId,
    score: score ?? null,
  });

  return mapReview(updated, updated._count.comments);
}

export async function rejectReview(
  reviewId: string,
  reviewerId: string,
  reason?: string
): Promise<ReviewQueueInfo> {
  const review = await getReviewOrThrow(reviewId);

  if (review.status !== "IN_REVIEW") {
    throw new Error(`Cannot reject review in "${review.status}" status`);
  }

  const updated = await prisma.reviewQueue.update({
    where: { id: reviewId },
    data: {
      status: "REJECTED",
      reviewerId,
      reviewedAt: new Date(),
    },
    include: {
      _count: { select: { comments: true } },
    },
  });

  if (reason) {
    await prisma.reviewComment.create({
      data: {
        content: `Review rejected: ${reason}`,
        reviewId,
        authorId: reviewerId,
      },
    });
  }

  logger.info("Review rejected", {
    reviewId,
    reviewerId,
    reason: reason ?? null,
  });

  return mapReview(updated, updated._count.comments + (reason ? 1 : 0));
}

export async function markNeedsImprovement(
  reviewId: string,
  reviewerId: string,
  comments: string
): Promise<ReviewQueueInfo> {
  const review = await getReviewOrThrow(reviewId);

  if (review.status !== "IN_REVIEW") {
    throw new Error(
      `Cannot mark review as needs improvement in "${review.status}" status`
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.reviewQueue.update({
      where: { id: reviewId },
      data: {
        status: "NEEDS_IMPROVEMENT",
        reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        _count: { select: { comments: true } },
      },
    }),
    prisma.reviewComment.create({
      data: {
        content: comments,
        reviewId,
        authorId: reviewerId,
      },
    }),
  ]);

  logger.info("Review marked as needs improvement", {
    reviewId,
    reviewerId,
  });

  return mapReview(updated, updated._count.comments + 1);
}

export async function addComment(
  reviewId: string,
  authorId: string,
  content: string
): Promise<ReviewCommentInfo> {
  await getReviewOrThrow(reviewId);

  const comment = await prisma.reviewComment.create({
    data: {
      content,
      reviewId,
      authorId,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  logger.info("Review comment added", {
    reviewId,
    authorId,
    commentId: comment.id,
  });

  return {
    id: comment.id,
    content: comment.content,
    reviewId: comment.reviewId,
    authorId: comment.authorId,
    author: comment.author,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

export async function getReviewStats(
  organizationId: string
): Promise<{
  pending: number;
  inReview: number;
  approved: number;
  rejected: number;
  needsImprovement: number;
  total: number;
  averageScore: number | null;
}> {
  const [pending, inReview, approved, rejected, needsImprovement, total, avgResult] =
    await Promise.all([
      prisma.reviewQueue.count({
        where: { organizationId, status: "PENDING" },
      }),
      prisma.reviewQueue.count({
        where: { organizationId, status: "IN_REVIEW" },
      }),
      prisma.reviewQueue.count({
        where: { organizationId, status: "APPROVED" },
      }),
      prisma.reviewQueue.count({
        where: { organizationId, status: "REJECTED" },
      }),
      prisma.reviewQueue.count({
        where: { organizationId, status: "NEEDS_IMPROVEMENT" },
      }),
      prisma.reviewQueue.count({ where: { organizationId } }),
      prisma.reviewQueue.aggregate({
        where: { organizationId, score: { not: null } },
        _avg: { score: true },
      }),
    ]);

  return {
    pending,
    inReview,
    approved,
    rejected,
    needsImprovement,
    total,
    averageScore: avgResult._avg.score,
  };
}

export async function getMyReviews(
  userId: string,
  options: { status?: ReviewStatus; limit?: number; offset?: number } = {}
): Promise<{ reviews: ReviewQueueInfo[]; total: number }> {
  const { status, limit = 20, offset = 0 } = options;

  const where: Record<string, unknown> = {
    OR: [{ assigneeId: userId }, { reviewerId: userId }],
  };
  if (status) where.status = status;

  const [reviews, total] = await Promise.all([
    prisma.reviewQueue.findMany({
      where,
      include: {
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.reviewQueue.count({ where }),
  ]);

  return {
    reviews: reviews.map((r) => mapReview(r, r._count.comments)),
    total,
  };
}

export async function getReviewHistory(
  resourceType: string,
  resourceId: string
): Promise<ReviewQueueInfo[]> {
  const reviews = await prisma.reviewQueue.findMany({
    where: { resourceType, resourceId },
    include: {
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reviews.map((r) => mapReview(r, r._count.comments));
}
