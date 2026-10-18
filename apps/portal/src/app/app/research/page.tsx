import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FolderOpen, MessageSquare, Microscope } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { Card } from "@/components/ui/card";
import { kbWorkspaceHref } from "@/components/app/kb-workspace-tabs";

export const metadata = {
  title: "Research",
};

// The research hub: the grounded-chat experience lives inside each knowledge
// base, so this page lists the workspaces to research in and the sessions you
// can pick back up. Everything is scoped to the caller's project and userId.
export default async function ResearchPage() {
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

  const [knowledgeBases, conversations] = await Promise.all([
    listKnowledgeBases(),
    projectId
      ? prisma.conversation.findMany({
          where: { userId: session.user.id, knowledgeBase: { projectId } },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            knowledgeBaseId: true,
            knowledgeBase: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const readyToResearch = knowledgeBases.filter((kb) => kb._count.documents > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="page-title">Research</h1>
        <p className="page-description mt-1">
          Ask questions grounded in your own sources and follow the citations back to the text.
        </p>
      </header>

      {knowledgeBases.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
            <Microscope size={26} className="text-brand" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-text-primary">Nothing to research yet</h2>
          <p className="mt-2 max-w-md text-sm text-text-secondary">
            Create a workspace and add sources, then come back here to ask questions grounded in them.
          </p>
          <Link
            href="/app/knowledge-bases"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Create a workspace
            <ArrowRight size={14} />
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-brand" />
              <h2 className="text-sm font-semibold text-text-primary">Start researching</h2>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">
              Open a workspace to start a grounded conversation.
            </p>
            <div className="mt-4 space-y-2">
              {knowledgeBases.slice(0, 6).map((kb) => (
                <Link
                  key={kb.id}
                  href={kbWorkspaceHref(kb.id, "research")}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/50 px-3 py-2.5 transition-colors hover:border-border-hover hover:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{kb.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {kb._count.documents} source{kb._count.documents !== 1 ? "s" : ""}
                      {kb._count.documents === 0 ? " — add sources first" : ""}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
            {readyToResearch.length === 0 && (
              <p className="mt-3 text-xs text-text-tertiary">
                Add sources to a workspace to enable grounded answers.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-brand" />
              <h2 className="text-sm font-semibold text-text-primary">Pick up a session</h2>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">Your most recent conversations.</p>
            {conversations.length > 0 ? (
              <div className="mt-4 space-y-2">
                {conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`${kbWorkspaceHref(conversation.knowledgeBaseId, "research")}?conversation=${conversation.id}`}
                    className="group block rounded-lg border border-border bg-surface/50 px-3 py-2.5 transition-colors hover:border-border-hover hover:bg-surface-hover"
                  >
                    <p className="truncate text-sm font-medium text-text-primary">
                      {conversation.title || "Untitled conversation"}
                    </p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {conversation.knowledgeBase.name} · {conversation.updatedAt.toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-tertiary">
                No conversations yet. Open a workspace above to ask your first question.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
