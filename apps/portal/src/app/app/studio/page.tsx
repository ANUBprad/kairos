import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import type { ArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { kbWorkspaceHref } from "@/components/app/kb-workspace-tabs";
import { ARTIFACT_TYPE_META, isActiveStudioArtifactType } from "@/components/app/studio/artifact-type-meta";

export const metadata = {
  title: "Studio",
};

// Cross-workspace view of generated artifacts. Each row links back into the
// owning knowledge base, where generation and study live. Scoped to the
// caller's project; nothing here reaches another tenant's artifacts.
export default async function StudioPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/api/session");

  let projectId: string | null = null;
  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const result = await ensureDefaultOrg();
    if (result) projectId = result.project.id;
  } catch {
    projectId = null;
  }

  const artifacts = projectId
    ? await prisma.learningArtifact.findMany({
        where: { knowledgeBase: { projectId } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          createdAt: true,
          knowledgeBaseId: true,
          knowledgeBase: { select: { name: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Studio</h1>
          <p className="page-description mt-1">
            Summaries, reports, quizzes and other artifacts you have created from your sources.
          </p>
        </div>
        <Link
          href="/app/knowledge-bases"
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary sm:flex"
        >
          <Sparkles size={14} />
          Create in a workspace
        </Link>
      </header>

      {artifacts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
            <Sparkles size={26} className="text-brand" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-text-primary">No artifacts yet</h2>
          <p className="mt-2 max-w-md text-sm text-text-secondary">
            Open a workspace and use its Studio tab to generate a summary, report, quiz or more from
            your sources.
          </p>
          <Link
            href="/app/knowledge-bases"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Go to Library
            <ArrowRight size={14} />
          </Link>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {artifacts.map((artifact) => {
            const meta = isActiveStudioArtifactType(artifact.type as ArtifactType)
              ? ARTIFACT_TYPE_META[artifact.type as keyof typeof ARTIFACT_TYPE_META]
              : null;
            const Icon = meta?.Icon;
            const completed = artifact.status === "COMPLETED";
            const href = completed
              ? `/app/knowledge-bases/${artifact.knowledgeBaseId}/artifacts/${artifact.id}`
              : kbWorkspaceHref(artifact.knowledgeBaseId, "studio");
            return (
              <Link
                key={artifact.id}
                href={href}
                className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover"
              >
                {Icon ? <Icon size={16} className="shrink-0 text-text-tertiary" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {artifact.name || `Untitled ${meta?.label.toLowerCase() ?? "artifact"}`}
                  </p>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    {artifact.knowledgeBase.name} · {artifact.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {meta ? (
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {meta.label}
                    </Badge>
                  ) : null}
                  <Badge variant={completed ? "success" : artifact.status === "FAILED" ? "destructive" : "secondary"}>
                    {artifact.status.toLowerCase()}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
