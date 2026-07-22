"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  FileText,
  Layers,
  Braces,
  Search,
  History,
  Sparkles,
  BarChart3,
  RefreshCw,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingBadge } from "@/components/app/processing-badge";
import { DocumentSummary } from "@/components/app/document-workspace/document-summary";
import { ProcessingPipeline, buildPipelineStages } from "@/components/app/document-workspace/processing-pipeline";
import { ChunkExplorer } from "@/components/app/document-workspace/chunk-explorer";
import { MetadataInspector } from "@/components/app/document-workspace/metadata-inspector";
import { RetrievalInspector } from "@/components/app/document-workspace/retrieval-inspector";
import { VersionHistory } from "@/components/app/document-workspace/version-history";
import { ActivityTimeline } from "@/components/app/document-workspace/activity-timeline";
import { AiSuggestions } from "@/components/app/document-workspace/ai-suggestions";
import { RenameDocumentDialog } from "@/components/app/rename-document-dialog";
import { DeleteDocumentDialog } from "@/components/app/delete-document-dialog";
import { reprocessDocument } from "@/lib/actions/document";
import { updateDocumentMetadata } from "@/lib/actions/document";
import { toast } from "sonner";
import type { DocumentWithDetailsAndRelations } from "@/components/app/document-workspace/types";

interface DocumentDetailsClientProps {
  document: DocumentWithDetailsAndRelations;
  kbId: string;
}

type TabId = "overview" | "chunks" | "metadata" | "retrieval" | "versions" | "activity" | "suggestions";

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "chunks", label: "Chunks", icon: Layers },
  { id: "metadata", label: "Metadata", icon: Braces },
  { id: "retrieval", label: "Retrieval", icon: Search },
  { id: "versions", label: "Versions", icon: History },
  { id: "activity", label: "Activity", icon: BarChart3 },
  { id: "suggestions", label: "AI Insights", icon: Sparkles },
];

export function DocumentDetailsClient({ document, kbId }: DocumentDetailsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; knowledgeBaseId: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; knowledgeBaseId: string } | null>(null);

  const pipelineStages = buildPipelineStages(document.status, document.metadata);

  const handleReprocess = async () => {
    try {
      const formData = new FormData();
      formData.set("id", document.id);
      await reprocessDocument(formData);
      toast.success("Reprocessing started");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reprocess");
    }
  };

  const handleDownload = () => {
    if (document.storageUrl) window.open(document.storageUrl, "_blank");
  };

  const handleMetadataUpdate = async (metadata: Record<string, unknown>) => {
    await updateDocumentMetadata(document.id, metadata);
    toast.success("Metadata updated");
    router.refresh();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href={`/app/knowledge-bases/${kbId}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-colors mt-0.5"
            aria-label="Back to knowledge base"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary truncate">{document.name}</h1>
              <ProcessingBadge status={document.status} />
            </div>
            <p className="text-sm text-text-tertiary mt-0.5">
              {document.fileType.toUpperCase()} &middot; {document.knowledgeBase.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            <Download size={14} />
            Download
          </Button>
          <Button variant="secondary" size="sm" onClick={handleReprocess}>
            <RefreshCw size={14} />
            Reprocess
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRenameTarget({ id: document.id, name: document.name, knowledgeBaseId: kbId })}>
            <Pencil size={14} />
            Rename
          </Button>
          <Button variant="secondary" size="sm" className="!border-error/30 !text-error hover:!bg-error/10" onClick={() => setDeleteTarget({ id: document.id, name: document.name, knowledgeBaseId: kbId })}>
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-brand text-brand"
                  : "border-transparent text-text-tertiary hover:text-text-secondary hover:border-border"
              )}
            >
              <Icon size={14} />
              {tab.label}
              {tab.id === "chunks" && document._count.chunks > 0 && (
                <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary">
                  {document._count.chunks}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div role="tabpanel">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <DocumentSummary document={document} />
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Processing Pipeline</h3>
              <ProcessingPipeline
                stages={pipelineStages}
                status={document.status}
                onRetry={handleReprocess}
              />
            </div>
          </div>
        )}

        {activeTab === "chunks" && (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <ChunkExplorer chunks={document.chunks} />
          </div>
        )}

        {activeTab === "metadata" && (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <MetadataInspector
              metadata={document.metadata}
              onUpdate={handleMetadataUpdate}
            />
          </div>
        )}

        {activeTab === "retrieval" && (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <RetrievalInspector chunks={document.chunks} />
          </div>
        )}

        {activeTab === "versions" && (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <VersionHistory versions={document.versions} />
          </div>
        )}

        {activeTab === "activity" && (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <ActivityTimeline activities={document.activities} />
          </div>
        )}

        {activeTab === "suggestions" && (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <AiSuggestions />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <RenameDocumentDialog
        document={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteDocumentDialog
        document={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
