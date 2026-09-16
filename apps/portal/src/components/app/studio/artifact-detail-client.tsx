"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactContent } from "./artifact-content";
import { ARTIFACT_TYPE_META, isActiveStudioArtifactType } from "./artifact-type-meta";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  kbId: string;
  kbName: string;
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  returnConversationId: string | null;
}

const NAV_TABS = [
  { label: "Sources", href: (kbId: string) => `/app/knowledge-bases/${kbId}` },
  { label: "Chat", href: (kbId: string) => `/app/knowledge-bases/${kbId}/chat` },
  { label: "Studio", href: (kbId: string) => `/app/knowledge-bases/${kbId}/studio` },
  { label: "Study", href: (kbId: string) => `/app/knowledge-bases/${kbId}/study` },
];

// Full artifact detail page shell. Reuses the shared ArtifactContent viewer
// router (same seven viewers as the Studio dialog) and adds a back-to-research
// return link so the chat ↔ artifact loop is closed.
export function ArtifactDetailClient({
  kbId,
  kbName,
  artifact,
  sources,
  returnConversationId,
}: Props) {
  const router = useRouter();
  const meta = isActiveStudioArtifactType(artifact.type) ? ARTIFACT_TYPE_META[artifact.type] : null;
  const backHref = `/app/knowledge-bases/${kbId}/chat${
    returnConversationId ? `?conversation=${returnConversationId}` : ""
  }`;

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-2xl font-semibold text-text-primary">
              {meta && <meta.Icon size={20} className="shrink-0 text-text-tertiary" />}
              <span className="truncate">
                {artifact.name || `Untitled ${meta?.label.toLowerCase() ?? "artifact"}`}
              </span>
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {meta?.label ?? artifact.type} · {kbName} ·{" "}
              {new Date(artifact.createdAt).toLocaleDateString()}
            </p>
          </div>
          <ArtifactStatusBadge status={artifact.status} />
        </div>

        <nav
          className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
          aria-label="Knowledge base workspace"
        >
          {NAV_TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href(kbId)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              {tab.label}
            </Link>
          ))}
          <span className="rounded-md bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
            Artifact
          </span>
        </nav>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft size={14} />
              Back to research
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/app/knowledge-bases/${kbId}/studio`}>
              <Sparkles size={14} />
              Studio
            </Link>
          </Button>
        </div>
      </header>

      <ArtifactContent
        artifact={artifact}
        sources={sources}
        onClose={() => router.push(backHref)}
      />
    </div>
  );
}
