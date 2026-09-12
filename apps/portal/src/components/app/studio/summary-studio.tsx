"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProcessingBadge } from "@/components/app/processing-badge";
import { SourceTypeBadge } from "@/components/app/source-type-badge";
import { generateSummaryArtifact } from "@/lib/actions/artifacts";
import type { SourceListItem } from "@/lib/source-contract";
import type { LearningArtifactData } from "@/lib/artifacts/types";
import { SummaryArtifactViewer } from "./summary-artifact-viewer";

interface Props {
  kbId: string;
  kbName: string;
  sources: SourceListItem[];
}

const TABS = [
  { label: "Sources", href: (kbId: string) => `/app/knowledge-bases/${kbId}` },
  { label: "Chat", href: (kbId: string) => `/app/knowledge-bases/${kbId}/chat` },
];

export function SummaryStudio({ kbId, kbName, sources }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [artifactName, setArtifactName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<LearningArtifactData | null>(null);

  const selectedCount = selectedIds.length;

  const toggleSource = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const generate = async () => {
    if (selectedCount === 0 || generating) return;
    setGenerating(true);
    setError(null);
    setGenerated(null);
    try {
      const artifact = await generateSummaryArtifact(
        kbId,
        selectedIds,
        artifactName.trim() || undefined,
      );
      setGenerated(artifact);
      setSelectedIds([]);
      setArtifactName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Studio</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Generate learning artifacts from the sources in {kbName}.
        </p>

        <nav
          className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
          aria-label="Knowledge base workspace"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href(kbId)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              {tab.label}
            </Link>
          ))}
          <span className="rounded-md bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
            Studio
          </span>
        </nav>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5" aria-label="Summary generator">
        <h2 className="text-base font-semibold text-text-primary">Generate a summary</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Pick the sources to summarize, then generate. Only indexed sources can be selected.
        </p>

        {sources.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
            <FileText size={24} className="text-text-tertiary" />
            <p className="mt-3 text-sm font-medium text-text-primary">No sources yet</p>
            <p className="mt-1 text-xs text-text-tertiary">Add sources before generating summaries.</p>
            <Link href={`/app/knowledge-bases/${kbId}`} className="mt-4">
              <Button variant="secondary" size="sm">
                Go to sources
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-4 space-y-1">
              {sources.map((source) => {
                const selectable = source.status === "INDEXED";
                const checked = selectedIds.includes(source.id);
                return (
                  <li
                    key={source.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                      checked ? "bg-brand/5" : "hover:bg-surface-hover"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectable}
                      onChange={() => toggleSource(source.id)}
                      className="shrink-0 accent-brand disabled:opacity-40"
                      aria-label={`Select ${source.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      {source.name}
                    </span>
                    <SourceTypeBadge sourceType={source.sourceType} />
                    {!selectable && <ProcessingBadge status={source.status} />}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Input
                value={artifactName}
                onChange={(e) => setArtifactName(e.target.value)}
                placeholder="Name (optional)"
                disabled={generating}
                className="max-w-xs"
                aria-label="Artifact name"
              />
              <Button
                variant="primary"
                disabled={selectedCount === 0 || generating}
                onClick={generate}
              >
                {generating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {generating ? "Generating…" : "Generate Summary"}
              </Button>
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
              <span>
                {selectedCount === 0
                  ? "No sources selected"
                  : `${selectedCount} source${selectedCount !== 1 ? "s" : ""} selected`}
              </span>
              {selectedCount > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="font-medium text-brand transition-colors hover:underline"
                >
                  Clear selection
                </button>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
              >
                {error}
              </p>
            )}
          </>
        )}
      </section>

      {generated && (
        <div className="mt-6">
          <SummaryArtifactViewer
            artifact={generated}
            sources={sources}
            onClose={() => setGenerated(null)}
          />
        </div>
      )}
    </div>
  );
}