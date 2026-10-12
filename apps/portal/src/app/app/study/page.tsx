import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { getStudyCountsForProject } from "@/lib/study";
import { Card } from "@/components/ui/card";
import { kbWorkspaceHref } from "@/components/app/kb-workspace-tabs";

export const metadata = {
  title: "Study",
};

// Study is spread across workspaces (each quiz/flashcard deck is a Studio
// artifact owned by one knowledge base). This destination surfaces the decks
// you can study and the progress recorded against them, then routes into the
// workspace where the study experience lives.
export default async function StudyPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  let projectId: string | null = null;
  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const result = await ensureDefaultOrg();
    if (result) projectId = result.project.id;
  } catch {
    projectId = null;
  }

  const knowledgeBases = await listKnowledgeBases();
  const kbIds = knowledgeBases.map((kb) => kb.id);

  const [counts, studyArtifactGroups] = await Promise.all([
    projectId
      ? getStudyCountsForProject(session.user.id, projectId)
      : Promise.resolve({ quizzesTaken: 0, cardsKnown: 0 }),
    kbIds.length > 0
      ? prisma.learningArtifact.groupBy({
          by: ["knowledgeBaseId"],
          where: { knowledgeBaseId: { in: kbIds }, type: { in: ["QUIZ", "FLASHCARDS"] } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const artifactCountByKb = new Map(
    studyArtifactGroups.map((group) => [group.knowledgeBaseId, group._count._all])
  );
  const studyWorkspaces = knowledgeBases.filter((kb) => artifactCountByKb.has(kb.id));
  const hasActivity = counts.quizzesTaken > 0 || counts.cardsKnown > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="page-title">Study</h1>
        <p className="page-description mt-1">
          Practice with quizzes and flashcards generated from your sources, and track what you have learned.
        </p>
      </header>

      {(hasActivity || studyWorkspaces.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Quizzes taken
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-text-primary">{counts.quizzesTaken}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Cards known
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-text-primary">{counts.cardsKnown}</p>
          </div>
        </div>
      )}

      {studyWorkspaces.length > 0 ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text-primary">Study sets</h2>
          <p className="mt-1 text-xs text-text-tertiary">Decks you can review, grouped by workspace.</p>
          <div className="mt-4 space-y-2">
            {studyWorkspaces.map((kb) => (
              <Link
                key={kb.id}
                href={kbWorkspaceHref(kb.id, "study")}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/50 px-3 py-2.5 transition-colors hover:border-border-hover hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{kb.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {artifactCountByKb.get(kb.id)} study artifact
                    {artifactCountByKb.get(kb.id) !== 1 ? "s" : ""}
                  </p>
                </div>
                <ArrowRight
                  size={14}
                  className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
            <GraduationCap size={26} className="text-brand" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-text-primary">Nothing to study yet</h2>
          <p className="mt-2 max-w-md text-sm text-text-secondary">
            Generate a quiz or flashcard deck in a workspace&apos;s Studio tab, then they will show up here.
          </p>
          <Link
            href="/app/knowledge-bases"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Go to Library
            <ArrowRight size={14} />
          </Link>
        </Card>
      )}
    </div>
  );
}
