"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProcessingBadge } from "@/components/app/processing-badge";
import { SourceTypeBadge } from "@/components/app/source-type-badge";
import {
  generateSummaryArtifact,
  generateReportArtifact,
  generateQuizArtifact,
  generateFlashcardsArtifact,
  generateMindmapArtifact,
  generateTakeawaysArtifact,
  generatePodcastArtifact,
} from "@/lib/actions/artifacts";
import type { SourceListItem } from "@/lib/source-contract";
import type { LearningArtifactData } from "@/lib/artifacts/types";
import {
  ACTIVE_STUDIO_ARTIFACT_TYPES,
  ARTIFACT_TYPE_META,
  type ActiveStudioArtifactType,
} from "./artifact-type-meta";
import { ArtifactList } from "./artifact-list";
import { ArtifactDialog } from "./artifact-dialog";

interface Props {
  kbId: string;
  kbName: string;
  sources: SourceListItem[];
  initialArtifacts: LearningArtifactData[];
}

const TABS = [
  { label: "Sources", href: (kbId: string) => `/app/knowledge-bases/${kbId}` },
  { label: "Chat", href: (kbId: string) => `/app/knowledge-bases/${kbId}/chat` },
];

// Exactly the seven supported artifact types. Everything else is intentionally
// absent: the UI cannot generate a type that has no studio action.
const GENERATORS: Readonly<
  Record<ActiveStudioArtifactType, (kbId: string, sourceIds: string[], name?: string) => Promise<LearningArtifactData>>
> = {
  SUMMARY: generateSummaryArtifact,
  REPORT: generateReportArtifact,
  QUIZ: generateQuizArtifact,
  FLASHCARDS: generateFlashcardsArtifact,
  MINDMAP: generateMindmapArtifact,
  TAKEAWAYS: generateTakeawaysArtifact,
  PODCAST: generatePodcastArtifact,
};

export function ArtifactStudio({ kbId, kbName, sources, initialArtifacts }: Props) {
  const [artifactType, setArtifactType] = useState<ActiveStudioArtifactType>("SUMMARY");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [artifactName, setArtifactName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<LearningArtifactData[]>(initialArtifacts);
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);

  const selectedCount = selectedIds.length;
  const typeMeta = ARTIFACT_TYPE_META[artifactType];

  const toggleSource = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const generate = async () => {
    if (selectedCount === 0 || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const artifact = await GENERATORS[artifactType](
        kbId,
        selectedIds,
        artifactName.trim() || undefined,
      );
      setArtifacts((prev) => [artifact, ...prev]);
      setOpenArtifactId(artifact.id);
      setSelectedIds([]);
      setArtifactName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Artifact generation failed");
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

      <section className="rounded-xl border border-border bg-surface p-5" aria-label="Artifact generator">
        <h2 className="text-base font-semibold text-text-primary">Generate an artifact</h2>

        <div
          className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
          role="group"
          aria-label="Artifact type"
        >
          {ACTIVE_STUDIO_ARTIFACT_TYPES.map((type) => {
            const meta = ARTIFACT_TYPE_META[type];
            const selected = type === artifactType;
            return (
              <button
                key={type}
                disabled={generating}
                onClick={() => setArtifactType(type)}
                aria-pressed={selected}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-brand/10 text-brand"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                } disabled:opacity-50`}
              >
                <meta.Icon size={13} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-text-secondary">{typeMeta.description}</p>
        <p className="mt-1 text-sm text-text-secondary">
          Pick the sources to work with, then generate. Only indexed sources can be selected.
        </p>

        {sources.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
            <FileText size={24} className="text-text-tertiary" />
            <p className="mt-3 text-sm font-medium text-text-primary">No sources yet</p>
            <p className="mt-1 text-xs text-text-tertiary">Add sources before generating artifacts.</p>
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
                {generating ? "Generating…" : `Generate ${typeMeta.label}`}
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

      <section className="mt-6 rounded-xl border border-border bg-surface" aria-label="Generated artifacts">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">Artifacts</h2>
          <span className="text-xs font-medium text-text-tertiary">
            {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
          </span>
        </header>
        <ArtifactList artifacts={artifacts} onOpen={setOpenArtifactId} />
      </section>

      <ArtifactDialog
        kbId={kbId}
        artifactId={openArtifactId}
        sources={sources}
        onClose={() => setOpenArtifactId(null)}
      />
    </div>
  );
}