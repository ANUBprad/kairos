"use client";

import React, { useState } from "react";
import { LearningArtifact } from "../types";
import { FlashcardsViewer } from "./flashcards-viewer";
import { QuizViewer } from "./quiz-viewer";
import { MindmapViewer } from "./mindmap-viewer";
import { TakeawaysViewer } from "./takeaways-viewer";
import { SummaryViewer } from "./summary-viewer";
import { PodcastViewer } from "./podcast-viewer";
import { formatDate } from "@/lib/utils";
import {
  X,
  BookOpen,
  HelpCircle,
  Layers,
  Network,
  ListChecks,
  FileText,
  Copy,
  Check,
  Calendar,
} from "lucide-react";
import { AudioLinesIcon } from "@/components/ui/audio-lines";

import { ExternalLink } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { apiClient } from "@/lib/api-client";
import { dismissOnBackdropClick } from "@/lib/modal";

import { useQueryClient } from "@tanstack/react-query";

interface ArtifactModalProps {
  artifact: LearningArtifact | null;
  onClose: () => void;
}

export function ArtifactModal({ artifact, onClose }: ArtifactModalProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isExportingNotion, setIsExportingNotion] = useState(false);
  const [exportedNotionPage, setExportedNotionPage] = useState<{
    artifactId: string;
    url: string;
  } | null>(null);

  if (!artifact) return null;

  const existingNotionUrl = artifact.metadata?.notionPageUrl;
  const exportedNotionUrl =
    exportedNotionPage?.artifactId === artifact.id
      ? exportedNotionPage.url
      : typeof existingNotionUrl === "string"
        ? existingNotionUrl
        : null;

  const handleExportNotion = async () => {
    if (!artifact.workspaceId || !artifact.id) return;
    setIsExportingNotion(true);
    try {
      const res = await apiClient<{ success: boolean; url: string }>(
        `/api/workspaces/${artifact.workspaceId}/artifacts/${artifact.id}/export/notion`,
        { method: "POST" }
      );
      if (res.url) {
        setExportedNotionPage({ artifactId: artifact.id, url: res.url });
        void queryClient.invalidateQueries({
          queryKey: ["artifacts", artifact.workspaceId],
        });
      }
    } catch (err: unknown) {
      console.error("Failed to export to Notion:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to export to Notion. Please ensure your Notion workspace is connected in Settings."
      );
    } finally {
      setIsExportingNotion(false);
    }
  };



  const handleCopyMarkdown = () => {
    let textToCopy = "";
    if (artifact.content?.markdown) {
      textToCopy = artifact.content.markdown;
    } else if (artifact.content?.items) {
      textToCopy = artifact.content.items.map((it) => `- ${it}`).join("\n");
    } else if (artifact.content?.cards) {
      textToCopy = artifact.content.cards
        .map((c) => `Q: ${c.front}\nA: ${c.back}\n`)
        .join("\n---\n");
    } else if (artifact.content?.podcast?.transcript) {
      textToCopy = artifact.content.podcast.transcript
        .map((t) => `${t.speaker.toUpperCase()}:\n${t.text}`)
        .join("\n\n");
    }
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTypeIcon = () => {
    switch (artifact.type) {
      case "SUMMARY":
        return <BookOpen className="w-5 h-5 text-foreground" />;
      case "FLASHCARDS":
        return <Layers className="w-5 h-5 text-foreground" />;
      case "QUIZ":
        return <HelpCircle className="w-5 h-5 text-foreground" />;
      case "MINDMAP":
        return <Network className="w-5 h-5 text-foreground" />;
      case "TAKEAWAYS":
        return <ListChecks className="w-5 h-5 text-foreground" />;
      case "REPORT":
        return <FileText className="w-5 h-5 text-foreground" />;
      case "PODCAST":
        return <AudioLinesIcon size={20} className="text-foreground" />;
      default:
        return <BookOpen className="w-5 h-5 text-foreground" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => dismissOnBackdropClick(e, onClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${artifact.title} artifact`}
        className="kairos-panel flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden animate-fadeIn text-foreground motion-reduce:animate-none"
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-panel/80 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
            <div className="kairos-inset flex size-10 shrink-0 items-center justify-center rounded-xl text-primary">
              {getTypeIcon()}
            </div>
            <div className="min-w-0">
              <h2 className="kairos-section-title truncate text-base sm:text-lg">
                {artifact.title}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="kairos-tag font-mono">
                  {artifact.type === "PODCAST" ? "Audio podcast" : artifact.type}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatDate(artifact.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Export to Notion */}
            <button
              type="button"
              onClick={handleExportNotion}
              disabled={isExportingNotion}
              title="Export to your connected Notion workspace"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
            >
              {isExportingNotion ? (
                <ThemeLoader size={13} />
              ) : exportedNotionUrl ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <BookOpen className="size-3.5" />
              )}
              <span>
                {isExportingNotion
                  ? "Exporting…"
                  : exportedNotionUrl
                  ? "Exported"
                  : "Export to Notion"}
              </span>
            </button>

            {exportedNotionUrl && (
              <a
                href={exportedNotionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 motion-reduce:transition-none"
              >
                <span>Open</span>
                <ExternalLink className="size-3" />
              </a>
            )}

            <button
              type="button"
              onClick={handleCopyMarkdown}
              title="Copy artifact content"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground motion-reduce:transition-none"
            >
              {copied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close artifact"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground motion-reduce:transition-none"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>


        {/* Modal Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-brand-quiet/30 p-4 sm:p-6">
          {/* Podcast Debate View */}
          {artifact.type === "PODCAST" && (
            <PodcastViewer
              content={artifact.content}
              artifactId={artifact.id}
              workspaceId={artifact.workspaceId}
            />
          )}


          {/* Flashcards View */}
          {artifact.type === "FLASHCARDS" && artifact.content?.cards && (
            <FlashcardsViewer cards={artifact.content.cards} />
          )}

          {/* Quiz View */}
          {artifact.type === "QUIZ" && artifact.content?.questions && (
            <QuizViewer questions={artifact.content.questions} />
          )}

          {/* Takeaways List */}
          {artifact.type === "TAKEAWAYS" && (
            <TakeawaysViewer content={artifact.content?.items || []} />
          )}

          {/* Summary / Report View */}
          {(artifact.type === "SUMMARY" || artifact.type === "REPORT") && (
            <SummaryViewer
              content={artifact.content?.markdown || ""}
              title={artifact.title}
            />
          )}

          {/* Mindmap Nodes View */}
          {(artifact.type === "MINDMAP" || artifact.type === "DIAGRAM") && (
            <MindmapViewer content={artifact.content} />
          )}

          {((artifact.type === "FLASHCARDS" && !artifact.content?.cards) ||
            (artifact.type === "QUIZ" && !artifact.content?.questions)) && (
            <div className="kairos-inset space-y-2 px-5 py-8 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
                <FileText className="size-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No reviewable content yet
              </p>
              <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
                This artifact was created, but its content isn’t available in this view.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
