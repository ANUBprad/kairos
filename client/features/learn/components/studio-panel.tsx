"use client";

import React, { useState } from "react";
import { LearningArtifact, ArtifactType } from "../types";
import { ArtifactModal } from "./artifact-modal";
import {
  Trash2,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Coins,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AudioLinesIcon } from "@/components/ui/audio-lines";
import {
  AnimatedBookOpen,
  AnimatedListChecks,
  AnimatedLayers,
  AnimatedHelpCircle,
  AnimatedNetwork,
  AnimatedFileText,
} from "@/components/ui/animated-icons";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { MovingBorderCard } from "@/components/ui/moving-border";
import {
  getArtifactCreditCost,
  useUpgradeModal,
  useUsage,
} from "@/features/billing";
import { cn, formatDate } from "@/lib/utils";

interface StudioPanelProps {
  artifacts: LearningArtifact[];
  onCreateArtifact: (type: ArtifactType) => Promise<unknown>;
  onDeleteArtifact: (id: string) => Promise<unknown>;
  onRetryArtifact?: (id: string) => Promise<unknown>;
  isCreating: boolean;
  isRetrying?: boolean;
  retryingArtifactId?: string;
  selectedSourcesCount: number;
}

const STUDIO_TOOLS: {
  type: ArtifactType;
  title: string;
  desc: string;
  renderIcon: (isHovered: boolean) => React.ReactNode;
}[] = [
  {
    type: "PODCAST",
    title: "Audio Debate Podcast",
    desc: "Two AI hosts debate & analyze your sources into an audio show",
    renderIcon: (isHovered) => (
      <AudioLinesIcon
        size={16}
        className={`text-primary transition-transform motion-reduce:transition-none ${
          isHovered ? "scale-110 motion-reduce:scale-100" : ""
        }`}
      />
    ),
  },
  {
    type: "SUMMARY",
    title: "Summary",
    desc: "Comprehensive overview of your sources",
    renderIcon: (isHovered) => (
      <AnimatedBookOpen
        size={16}
        isHovered={isHovered}
        className="text-primary"
      />
    ),
  },
  {
    type: "TAKEAWAYS",
    title: "Key Takeaways",
    desc: "Bullet points of the main findings",
    renderIcon: (isHovered) => (
      <AnimatedListChecks
        size={16}
        isHovered={isHovered}
        className="text-primary"
      />
    ),
  },
  {
    type: "FLASHCARDS",
    title: "Flashcards",
    desc: "Interactive flip study cards deck",
    renderIcon: (isHovered) => (
      <AnimatedLayers
        size={16}
        isHovered={isHovered}
        className="text-primary"
      />
    ),
  },
  {
    type: "QUIZ",
    title: "Practice Quiz",
    desc: "Test your understanding with instant score",
    renderIcon: (isHovered) => (
      <AnimatedHelpCircle
        size={16}
        isHovered={isHovered}
        className="text-primary"
      />
    ),
  },
  {
    type: "MINDMAP",
    title: "Mind Map",
    desc: "Hierarchical concept branches & nodes",
    renderIcon: (isHovered) => (
      <AnimatedNetwork
        size={16}
        isHovered={isHovered}
        className="text-primary"
      />
    ),
  },
];

function formatArtifactType(type: ArtifactType) {
  switch (type) {
    case "PODCAST":
      return "Audio podcast";
    case "TAKEAWAYS":
      return "Key takeaways";
    case "FLASHCARDS":
      return "Flashcards";
    case "QUIZ":
      return "Practice quiz";
    case "MINDMAP":
      return "Mind map";
    case "DIAGRAM":
      return "Diagram";
    case "REPORT":
      return "Report";
    default:
      return "Summary";
  }
}

export function StudioPanel({
  artifacts,
  onCreateArtifact,
  onDeleteArtifact,
  onRetryArtifact,
  isCreating,
  isRetrying = false,
  retryingArtifactId,
  selectedSourcesCount,
}: StudioPanelProps) {
  const { credits, dailyCredits, paidCredits, nextDailyResetAt } = useUsage();
  const [selectedArtifact, setSelectedArtifact] = useState<LearningArtifact | null>(null);
  const [generatingType, setGeneratingType] = useState<ArtifactType | null>(null);
  const [hoveredTool, setHoveredTool] = useState<ArtifactType | null>(null);

  const handleCreate = async (type: ArtifactType) => {
    const requiredCredits = getArtifactCreditCost(type);
    if (credits < requiredCredits) {
      useUpgradeModal.getState().openUpgradeModal({
        reason: `${type === "PODCAST" ? "Audio Debate Podcast" : "Artifact generation"} requires ${requiredCredits} credits. You have ${dailyCredits} daily and ${paidCredits} paid credits left. Daily credits reset ${nextDailyResetAt ? `at ${nextDailyResetAt.slice(0, 10)} ${nextDailyResetAt.slice(11, 16)} UTC` : "at 00:00 UTC"}.`,
        limitType: "credits",
        requiredCredits,
        currentCredits: credits,
      });
      return;
    }

    if (isCreating || selectedSourcesCount === 0) return;
    setGeneratingType(type);
    try {
      await onCreateArtifact(type);
    } catch (err) {
      console.error("Failed to create artifact:", err);
    } finally {
      setGeneratingType(null);
    }
  };

  const renderFailedActions = (artifactId: string) => {
    const isThisRetrying = isRetrying && retryingArtifactId === artifactId;

    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
          <AlertCircle className="size-2.5" />
          Failed
        </span>
        {onRetryArtifact && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void onRetryArtifact(artifactId);
            }}
            disabled={isThisRetrying}
            title="Retry generation"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:bg-brand-soft disabled:opacity-50 motion-reduce:transition-none"
          >
            <RefreshCw
              className={cn(
                "size-2.5",
                isThisRetrying && "animate-spin motion-reduce:animate-none"
              )}
            />
            Retry
          </button>
        )}
      </div>
    );
  };

  const getTypeIcon = (type: ArtifactType) => {
    switch (type) {
      case "PODCAST":
        return <AudioLinesIcon size={14} className="text-primary" />;
      case "SUMMARY":
        return <AnimatedBookOpen size={14} className="text-primary" />;
      case "FLASHCARDS":
        return <AnimatedLayers size={14} className="text-primary" />;
      case "QUIZ":
        return <AnimatedHelpCircle size={14} className="text-primary" />;
      case "MINDMAP":
        return <AnimatedNetwork size={14} className="text-primary" />;
      case "TAKEAWAYS":
        return <AnimatedListChecks size={14} className="text-primary" />;
      case "REPORT":
        return <AnimatedFileText size={14} className="text-primary" />;
      default:
        return <AnimatedBookOpen size={14} className="text-primary" />;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel text-foreground select-none">
      {/* Studio Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="kairos-inset flex size-8 items-center justify-center rounded-xl text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="kairos-eyebrow">Kairos Studio</p>
            <p className="text-[11px] text-muted-foreground">Artifact workspace</p>
          </div>
          <span className="kairos-tag font-mono">{artifacts.length}</span>
        </div>

        <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
          generate · review · revisit
        </span>
      </div>

      {/* Main Studio Scroll Container */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
        {/* Quick Tools Section */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="kairos-eyebrow">Create from sources</p>
              <h3 className="kairos-section-title mt-1 text-base">
                Choose an artifact
              </h3>
            </div>
            {selectedSourcesCount === 0 ? (
              <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[10px] font-medium text-warning animate-fadeIn motion-reduce:animate-none">
                Select sources to enable
              </span>
            ) : (
              <span className="kairos-tag font-mono">
                {selectedSourcesCount} selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STUDIO_TOOLS.map((tool) => {
              const isThisGenerating = generatingType === tool.type;
              const requiredCost = getArtifactCreditCost(tool.type);
              const hasInsufficientCredits = credits < requiredCost;

              const cardContent = (
                <div className="flex h-full w-full flex-col justify-between p-3.5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex size-8 items-center justify-center rounded-xl border border-border bg-brand-quiet text-primary transition-colors motion-reduce:transition-none">
                      {isThisGenerating ? (
                        <ThemeLoader size={16} />
                      ) : (
                        tool.renderIcon(hoveredTool === tool.type)
                      )}
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold",
                        tool.type === "PODCAST"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-border bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <Coins className="size-2.5 text-warning" />
                      {requiredCost} cr
                    </span>
                  </div>
                  <div>
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {tool.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                      {isThisGenerating ? "Generating…" : tool.desc}
                    </span>
                  </div>
                </div>
              );

              if (isThisGenerating) {
                return (
                  <MovingBorderCard
                    key={tool.type}
                    borderRadius="0.75rem"
                    duration={2000}
                    className="bg-brand-quiet/40 text-left"
                    containerClassName="h-full min-h-[104px] w-full"
                  >
                    {cardContent}
                  </MovingBorderCard>
                );
              }

              return (
                <button
                  key={tool.type}
                  type="button"
                  onClick={() => handleCreate(tool.type)}
                  onMouseEnter={() => setHoveredTool(tool.type)}
                  onMouseLeave={() => setHoveredTool(null)}
                  disabled={hasInsufficientCredits ? false : (isCreating || selectedSourcesCount === 0)}
                  title={
                    selectedSourcesCount === 0 && !hasInsufficientCredits
                      ? "Please select at least one source in the sources panel to generate artifacts"
                      : hasInsufficientCredits
                      ? `${tool.title} requires ${requiredCost} credits (Current balance: ${credits})`
                      : `Generate ${tool.title} (${requiredCost} credits)`
                  }
                  aria-label={`Generate ${tool.title}`}
                  className={cn(
                    "group flex min-h-[104px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all motion-reduce:transition-none",
                    !hasInsufficientCredits && selectedSourcesCount === 0
                      ? "border-border bg-muted/20 opacity-45 shadow-none cursor-not-allowed select-none"
                      : "kairos-card border-border bg-surface hover:border-brand/40 hover:bg-brand-quiet/60 active:scale-[0.99] motion-reduce:active:scale-100"
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex size-8 items-center justify-center rounded-xl border border-border bg-brand-quiet text-primary transition-colors motion-reduce:transition-none group-hover:bg-brand-soft">
                      {tool.renderIcon(hoveredTool === tool.type)}
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold",
                        tool.type === "PODCAST"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-border bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <Coins className="size-2.5 text-warning" />
                      {requiredCost} cr
                    </span>
                  </div>
                  <div>
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {tool.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                      {tool.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>


        {/* Artifacts History List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="kairos-eyebrow">Your library</p>
              <h3 className="kairos-section-title mt-1 text-base">
                Created artifacts
              </h3>
            </div>
            <span className="kairos-tag font-mono">{artifacts.length}</span>
          </div>

          {artifacts.length === 0 ? (
            <div className="kairos-inset space-y-2 rounded-2xl px-5 py-7 text-center text-muted-foreground">
              <div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-brand-soft text-primary">
                <Sparkles className="size-4" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                No artifacts yet
              </p>
              <p className="mx-auto max-w-56 text-[11px] leading-relaxed">
                Choose a tool above to turn your sources into study material.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {artifacts.map((artifact) => {
                const isReady = artifact.status === "READY";
                const isPending =
                  artifact.status === "PENDING" ||
                  artifact.status === "PROCESSING";

                const artifactCardBody = (
                  <div className="flex w-full items-center justify-between gap-2 p-3.5">
                    <div className="flex min-w-0 items-center gap-2.5 pr-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-brand-quiet text-primary">
                        {getTypeIcon(artifact.type)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {artifact.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{formatArtifactType(artifact.type)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {formatDate(artifact.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                          <ThemeLoader size={12} />
                          Generating…
                        </span>
                      )}

                      {artifact.status === "FAILED" &&
                        renderFailedActions(artifact.id)}

                      {isReady && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="size-3.5 text-success/80" />
                          <ChevronRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground motion-reduce:transition-none" />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${artifact.title}"?`)) {
                            onDeleteArtifact(artifact.id);
                          }
                        }}
                        title="Delete artifact"
                        aria-label={`Delete ${artifact.title}`}
                        className="rounded-lg p-1.5 text-muted-foreground opacity-60 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 motion-reduce:transition-none"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );

                if (isPending) {
                  return (
                    <MovingBorderCard
                      key={artifact.id}
                      borderRadius="0.75rem"
                      duration={2200}
                      className="bg-brand-quiet/40"
                      containerClassName="w-full"
                    >
                      {artifactCardBody}
                    </MovingBorderCard>
                  );
                }

                return (
                  <div
                    key={artifact.id}
                    className={cn(
                      "group flex items-center justify-between rounded-2xl border p-3.5 transition-all select-none motion-reduce:transition-none",
                      isReady
                        ? "kairos-card border-border bg-surface hover:border-brand/40 hover:bg-brand-quiet/50 cursor-pointer"
                        : "border-border bg-muted/20 shadow-none"
                    )}
                    title={isReady ? `Open ${artifact.title}` : undefined}
                    onClick={() => {
                      if (isReady) setSelectedArtifact(artifact);
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5 pr-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-brand-quiet text-primary">
                        {getTypeIcon(artifact.type)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {artifact.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{formatArtifactType(artifact.type)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {formatDate(artifact.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {artifact.status === "FAILED" &&
                        renderFailedActions(artifact.id)}

                      {isReady && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="size-3.5 text-success/80" />
                          <ChevronRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground motion-reduce:transition-none" />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${artifact.title}"?`)) {
                            onDeleteArtifact(artifact.id);
                          }
                        }}
                        title="Delete artifact"
                        aria-label={`Delete ${artifact.title}`}
                        className="rounded-lg p-1.5 text-muted-foreground opacity-60 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 motion-reduce:transition-none"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {/* Artifact Full Modal Viewer */}
      <ArtifactModal
        artifact={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
      />
    </div>
  );
}
