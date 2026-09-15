"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { resolveSourceProvenance } from "@/lib/artifacts/summary-view";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: Pick<LearningArtifactData, "knowledgeBaseId" | "sourceIds">;
  sources: { id: string; name: string | null }[];
}

// Shared provenance presentation for every artifact viewer. Resolves the stored
// sourceIds snapshot against the caller-scoped source list and renders available
// sources as navigable links inside the authenticated app. Deleted or
// unavailable sources are rendered as honest non-clickable fallback text — they
// never produce dead links, navigation 404s, or client exceptions.
export function ArtifactSourceList({ artifact, sources }: Props) {
  const provenance = resolveSourceProvenance(artifact.sourceIds, sources);
  if (provenance.length === 0) return null;

  const available = new Set(sources.map((s) => s.id));

  return (
    <ul className="mt-2 space-y-1.5">
      {provenance.map((ref) =>
        available.has(ref.id) ? (
          <li key={ref.id}>
            <Link
              href={`/app/knowledge-bases/${artifact.knowledgeBaseId}/${ref.id}`}
              className="flex items-center gap-2 text-sm font-medium text-brand transition-colors hover:text-brand-hover hover:underline"
            >
              <FileText size={13} className="shrink-0 text-text-tertiary" />
              <span className="truncate">{ref.name}</span>
            </Link>
          </li>
        ) : (
          <li key={ref.id} className="flex items-center gap-2 text-sm text-text-tertiary">
            <FileText size={13} className="shrink-0" />
            <span className="truncate">Unavailable source · {ref.id.slice(0, 8)}…</span>
          </li>
        ),
      )}
    </ul>
  );
}
