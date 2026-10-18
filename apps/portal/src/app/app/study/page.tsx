import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { getStudyCountsForProject } from "@/lib/study";
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
  if (!session?.user?.id) redirect("/api/session");

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
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:max-w-sm">
          <div className="bg-surface p-5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Quizzes taken
            </dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
              {counts.quizzesTaken}
            </dd>
          </div>
          <div className="bg-surface p-5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Cards known
            </dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
              {counts.cardsKnown}
            </dd>
          </div>
        </dl>
      )}

      {studyWorkspaces.length > 0 ? (
        <section
          className="overflow-hidden rounded-xl border border-border bg-surface"
          aria-label="Study sets"
        >
          <header className="border-b border-border px-5 py-4">
            <h2 className="section-title">Study sets</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Decks you can review, grouped by workspace.
            </p>
          </header>
          <ul className="divide-y divide-border">
            {studyWorkspaces.map((kb) => (
              <li key={kb.id}>
                <Link
                  href={kbWorkspaceHref(kb.id, "study")}
                  className="group flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{kb.name}</p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {artifactCountByKb.get(kb.id)} study artifact
                      {artifactCountByKb.get(kb.id) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand">
                    Study
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-16 text-center">
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
        </section>
      )}
    </div>
  );
}
