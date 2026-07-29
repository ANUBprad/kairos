"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  User,
  MessageSquare,
  Star,
  Loader2,
  FileText,
  Send,
  X,
  UserPlus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "sonner";
import {
  listReviewItems,
  getReviewItemStats,
  getReviewItem,
  createReviewItem,
  assignReviewItem,
  startReviewItem,
  approveReviewItem,
  rejectReviewItem,
  markReviewNeedsImprovement,
  addReviewComment,
} from "@/lib/actions/reviews";
import type {
  ReviewQueueInfo,
  ReviewCommentInfo,
  CreateReviewInput,
} from "@/lib/review-queue";
import type { ReviewStatus, ReviewPriority } from "@prisma/client";

const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; badge: "default" | "brand" | "success" | "warning" | "info"; icon: typeof Clock }
> = {
  PENDING: { label: "Pending", badge: "default", icon: Clock },
  IN_REVIEW: { label: "In Review", badge: "info", icon: Eye },
  APPROVED: { label: "Approved", badge: "success", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", badge: "default", icon: XCircle },
  NEEDS_IMPROVEMENT: { label: "Needs Improvement", badge: "warning", icon: AlertTriangle },
};

const PRIORITY_CONFIG: Record<
  ReviewPriority,
  { label: string; badge: "default" | "brand" | "success" | "warning" | "info" }
> = {
  LOW: { label: "Low", badge: "default" },
  NORMAL: { label: "Normal", badge: "brand" },
  HIGH: { label: "High", badge: "warning" },
  URGENT: { label: "Urgent", badge: "info" },
};

const STATUSES: ReviewStatus[] = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "NEEDS_IMPROVEMENT"];
const PRIORITIES: ReviewPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const RESOURCE_TYPES = ["PROMPT", "DATASET", "EXPERIMENT", "KNOWLEDGE_BASE", "DOCUMENT", "CUSTOM"];

export function ReviewsClient() {
  const [reviews, setReviews] = useState<ReviewQueueInfo[]>([]);
  const [stats, setStats] = useState<{
    pending: number;
    inReview: number;
    approved: number;
    rejected: number;
    needsImprovement: number;
    total: number;
    averageScore: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<ReviewPriority | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<
    (ReviewQueueInfo & { comments: ReviewCommentInfo[] }) | null
  >(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState<CreateReviewInput>({
    title: "",
    description: "",
    resourceType: "PROMPT",
    resourceId: "",
    priority: "NORMAL",
  });

  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [assigneeInput, setAssigneeInput] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const [reviewsResult, statsResult] = await Promise.all([
        listReviewItems({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          assigneeId: assigneeFilter || undefined,
          limit: 50,
        }),
        getReviewItemStats(),
      ]);

      if (reviewsResult.success && "reviews" in reviewsResult) {
        setReviews(reviewsResult.reviews);
      }
      if (statsResult.success && "stats" in statsResult) {
        setStats(statsResult.stats ?? null);
      }
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, assigneeFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleExpand = async (review: ReviewQueueInfo) => {
    if (expandedId === review.id) {
      setExpandedId(null);
      setExpandedReview(null);
      return;
    }

    setExpandedId(review.id);
    setExpandedLoading(true);
    try {
      const result = await getReviewItem(review.id);
      if (result.success && result.review) {
        setExpandedReview(result.review);
      }
    } catch {
      toast.error("Failed to load review details");
    } finally {
      setExpandedLoading(false);
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.resourceId.trim()) return;

    setCreateLoading(true);
    try {
      const result = await createReviewItem(createForm);
      if (result.success) {
        toast.success("Review created");
        setShowCreateModal(false);
        setCreateForm({
          title: "",
          description: "",
          resourceType: "PROMPT",
          resourceId: "",
          priority: "NORMAL",
        });
        fetchReviews();
      } else {
        toast.error(result.error || "Failed to create review");
      }
    } catch {
      toast.error("Failed to create review");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStartReview = async (reviewId: string) => {
    setActionLoading(reviewId);
    try {
      const result = await startReviewItem(reviewId);
      if (result.success) {
        toast.success("Review started");
        fetchReviews();
        if (expandedId === reviewId) {
          const detail = await getReviewItem(reviewId);
          if (detail.success && detail.review) setExpandedReview(detail.review);
        }
      } else {
        toast.error(result.error || "Failed to start review");
      }
    } catch {
      toast.error("Failed to start review");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (reviewId: string) => {
    setActionLoading(reviewId);
    try {
      const score = scoreInput ? parseFloat(scoreInput) : undefined;
      const result = await approveReviewItem(reviewId, score);
      if (result.success) {
        toast.success("Review approved");
        setScoreInput("");
        fetchReviews();
        if (expandedId === reviewId) {
          const detail = await getReviewItem(reviewId);
          if (detail.success && detail.review) setExpandedReview(detail.review);
        }
      } else {
        toast.error(result.error || "Failed to approve review");
      }
    } catch {
      toast.error("Failed to approve review");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (reviewId: string) => {
    setActionLoading(reviewId);
    try {
      const result = await rejectReviewItem(reviewId);
      if (result.success) {
        toast.success("Review rejected");
        fetchReviews();
        if (expandedId === reviewId) {
          const detail = await getReviewItem(reviewId);
          if (detail.success && detail.review) setExpandedReview(detail.review);
        }
      } else {
        toast.error(result.error || "Failed to reject review");
      }
    } catch {
      toast.error("Failed to reject review");
    } finally {
      setActionLoading(null);
    }
  };

  const handleNeedsImprovement = async (reviewId: string) => {
    if (!commentText.trim()) {
      toast.error("Please add a comment explaining what needs improvement");
      return;
    }
    setActionLoading(reviewId);
    try {
      const result = await markReviewNeedsImprovement(reviewId, commentText);
      if (result.success) {
        toast.success("Marked as needs improvement");
        setCommentText("");
        fetchReviews();
        if (expandedId === reviewId) {
          const detail = await getReviewItem(reviewId);
          if (detail.success && detail.review) setExpandedReview(detail.review);
        }
      } else {
        toast.error(result.error || "Failed to mark as needs improvement");
      }
    } catch {
      toast.error("Failed to mark as needs improvement");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddComment = async (reviewId: string) => {
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const result = await addReviewComment(reviewId, commentText);
      if (result.success) {
        setCommentText("");
        const detail = await getReviewItem(reviewId);
        if (detail.success && detail.review) setExpandedReview(detail.review);
      } else {
        toast.error(result.error || "Failed to add comment");
      }
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignTargetId || !assigneeInput.trim()) return;
    setActionLoading(assignTargetId);
    try {
      const result = await assignReviewItem(assignTargetId, assigneeInput);
      if (result.success) {
        toast.success("Review assigned");
        setShowAssignModal(false);
        setAssigneeInput("");
        fetchReviews();
        if (expandedId === assignTargetId) {
          const detail = await getReviewItem(assignTargetId);
          if (detail.success && detail.review) setExpandedReview(detail.review);
        }
      } else {
        toast.error(result.error || "Failed to assign review");
      }
    } catch {
      toast.error("Failed to assign review");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Review Queue"
        description="Manage human-in-the-loop review workflows for prompts, datasets, experiments, and knowledge base content."
        purpose="Review, approve, or request changes on AI resources before production use."
        relatedPages={[
          { label: "Knowledge Bases", href: "/app/knowledge-bases" },
          { label: "Settings", href: "/app/settings" },
        ]}
      />

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="!p-4 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10" />
              </Card>
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="!p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Pending", value: stats?.pending ?? 0, color: "text-text-secondary" },
              { label: "In Review", value: stats?.inReview ?? 0, color: "text-info" },
              { label: "Approved", value: stats?.approved ?? 0, color: "text-success" },
              { label: "Rejected", value: stats?.rejected ?? 0, color: "text-error" },
              { label: "Needs Improvement", value: stats?.needsImprovement ?? 0, color: "text-warning" },
            ].map((s) => (
              <Card key={s.label} className="!p-4">
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Filter by assignee ID..."
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | "")}
              className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as ReviewPriority | "")}
              className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} />
              Create Review
            </Button>
          </div>

          <div className="space-y-2">
            {reviews.length === 0 ? (
              <Card className="!p-12 text-center">
                <FileText size={40} className="mx-auto text-text-tertiary mb-3" />
                <p className="text-sm font-medium text-text-primary">No reviews found</p>
                <p className="text-xs text-text-tertiary mt-1">
                  {statusFilter || priorityFilter || assigneeFilter
                    ? "Try adjusting your filters"
                    : "Create a review to get started"}
                </p>
              </Card>
            ) : (
              reviews.map((review) => (
                <div key={review.id}>
                  <button
                    onClick={() => handleExpand(review)}
                    className={`w-full text-left rounded-xl border bg-surface p-4 transition-all hover:border-border-hover ${
                      expandedId === review.id ? "border-brand" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {expandedId === review.id ? (
                        <ChevronDown size={16} className="shrink-0 text-text-tertiary" />
                      ) : (
                        <ChevronRight size={16} className="shrink-0 text-text-tertiary" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-text-primary truncate">
                            {review.title}
                          </span>
                          <Badge variant={STATUS_CONFIG[review.status].badge}>
                            {STATUS_CONFIG[review.status].label}
                          </Badge>
                          <Badge variant={PRIORITY_CONFIG[review.priority].badge}>
                            {PRIORITY_CONFIG[review.priority].label}
                          </Badge>
                          <Badge variant="default">{review.resourceType}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-text-tertiary">
                          {review.assigneeId && (
                            <span className="flex items-center gap-1">
                              <User size={11} />
                              {review.assigneeId.slice(0, 12)}...
                            </span>
                          )}
                          {review.score != null && (
                            <span className="flex items-center gap-1">
                              <Star size={11} />
                              {review.score.toFixed(1)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MessageSquare size={11} />
                            {review.commentCount}
                          </span>
                          <span>{formatDate(review.createdAt)}</span>
                        </div>
                      </div>
                      {actionLoading === review.id && (
                        <Loader2 size={16} className="animate-spin text-brand shrink-0" />
                      )}
                    </div>
                  </button>

                  {expandedId === review.id && (
                    <div className="ml-6 mr-2 mb-2 rounded-xl border border-border bg-bg/50 p-5 space-y-5">
                      {expandedLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : expandedReview ? (
                        <>
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-sm font-semibold text-text-primary">Description</h3>
                              <p className="text-sm text-text-secondary mt-1">
                                {expandedReview.description || "No description provided."}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-text-tertiary">Resource Type</span>
                                <p className="font-medium text-text-primary">{expandedReview.resourceType}</p>
                              </div>
                              <div>
                                <span className="text-text-tertiary">Resource ID</span>
                                <p className="font-medium text-text-primary font-mono text-[11px]">
                                  {expandedReview.resourceId.slice(0, 16)}...
                                </p>
                              </div>
                              <div>
                                <span className="text-text-tertiary">Reviewer</span>
                                <p className="font-medium text-text-primary">
                                  {expandedReview.reviewerId
                                    ? expandedReview.reviewerId.slice(0, 12) + "..."
                                    : "Unassigned"}
                                </p>
                              </div>
                              <div>
                                <span className="text-text-tertiary">Reviewed At</span>
                                <p className="font-medium text-text-primary">
                                  {expandedReview.reviewedAt
                                    ? formatDate(expandedReview.reviewedAt)
                                    : "Not yet reviewed"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-text-primary">Comments</h3>
                            {expandedReview.comments.length === 0 ? (
                              <p className="text-xs text-text-tertiary">No comments yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {expandedReview.comments.map((c) => (
                                  <div key={c.id} className="rounded-lg border border-border bg-surface p-3">
                                    <div className="flex items-center gap-2 text-xs text-text-tertiary mb-1.5">
                                      <span className="font-medium text-text-primary">
                                        {c.author.name || c.author.email}
                                      </span>
                                      <span>{formatDate(c.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-text-secondary">{c.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Add a comment..."
                                className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddComment(expandedReview.id);
                                  }
                                }}
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleAddComment(expandedReview.id)}
                                disabled={commentLoading || !commentText.trim()}
                              >
                                {commentLoading ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Send size={14} />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setAssignTargetId(expandedReview.id);
                                setShowAssignModal(true);
                              }}
                              disabled={expandedReview.status === "APPROVED" || expandedReview.status === "REJECTED"}
                            >
                              <UserPlus size={14} />
                              Assign
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleStartReview(expandedReview.id)}
                              disabled={
                                expandedReview.status !== "PENDING" ||
                                actionLoading === expandedReview.id
                              }
                            >
                              <Eye size={14} />
                              Start Review
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApprove(expandedReview.id)}
                              disabled={
                                expandedReview.status !== "IN_REVIEW" ||
                                actionLoading === expandedReview.id
                              }
                            >
                              <CheckCircle2 size={14} />
                              Approve
                            </Button>
                            <Button
                              variant="danger-outline"
                              size="sm"
                              onClick={() => handleNeedsImprovement(expandedReview.id)}
                              disabled={
                                expandedReview.status !== "IN_REVIEW" ||
                                actionLoading === expandedReview.id
                              }
                            >
                              <AlertTriangle size={14} />
                              Needs Improvement
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReject(expandedReview.id)}
                              disabled={
                                expandedReview.status !== "IN_REVIEW" ||
                                actionLoading === expandedReview.id
                              }
                            >
                              <XCircle size={14} />
                              Reject
                            </Button>
                          </div>

                          {expandedReview.status === "IN_REVIEW" && (
                            <div className="flex items-center gap-2 pt-2">
                              <label className="text-xs font-medium text-text-secondary whitespace-nowrap">
                                Score (0-10):
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={scoreInput}
                                onChange={(e) => setScoreInput(e.target.value)}
                                placeholder="Optional"
                                className="w-24 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
                              />
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !createLoading && setShowCreateModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text-primary">Create Review</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-tertiary hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
                disabled={createLoading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Title *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Review prompt for customer support"
                  className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Description</label>
                <textarea
                  value={createForm.description || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description of what needs review..."
                  rows={3}
                  className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Resource Type</label>
                  <select
                    value={createForm.resourceType}
                    onChange={(e) => setCreateForm((f) => ({ ...f, resourceType: e.target.value }))}
                    className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
                  >
                    {RESOURCE_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Resource ID *</label>
                  <input
                    type="text"
                    value={createForm.resourceId}
                    onChange={(e) => setCreateForm((f) => ({ ...f, resourceId: e.target.value }))}
                    placeholder="e.g. prompt_abc123"
                    className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Priority</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, priority: e.target.value as ReviewPriority }))
                    }
                    className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Assignee ID</label>
                  <input
                    type="text"
                    value={createForm.assigneeId || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, assigneeId: e.target.value || undefined }))}
                    placeholder="Optional user ID"
                    className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={createLoading || !createForm.title.trim() || !createForm.resourceId.trim()}
                >
                  {createLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    "Create Review"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowAssignModal(false);
              setAssigneeInput("");
            }}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Assign Review</h2>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigneeInput("");
                }}
                className="text-text-tertiary hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Assignee User ID</label>
                <input
                  type="text"
                  value={assigneeInput}
                  onChange={(e) => setAssigneeInput(e.target.value)}
                  placeholder="Enter user ID..."
                  className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none font-mono"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssigneeInput("");
                  }}
                  disabled={actionLoading !== null}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleAssign}
                  disabled={actionLoading !== null || !assigneeInput.trim()}
                >
                  {actionLoading !== null ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Assign"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
