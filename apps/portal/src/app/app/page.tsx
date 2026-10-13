import { prisma } from "@/lib/prisma";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { getServerSession } from "@/lib/server/auth-utils";
import { getStudyCountsForProject } from "@/lib/study";
import { HomeView, type HomeData } from "@/components/app/home/home-view";

export const metadata = {
  title: "Home",
};

// Home answers four questions with real, tenant-scoped data: what to do next,
// what you were working on, what to revisit, and what to study. Every read is
// scoped to the caller's project (and userId for conversations/study), reusing
// the same authorized loaders as the Research, Studio and Study hubs. Nothing
// is counted, dated or invented here — the counts come from the rows.
export default async function AppPage() {
  const session = await getServerSession();

  let projectId: string | null = null;
  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const result = await ensureDefaultOrg();
    if (result) projectId = result.project.id;
  } catch {
    // Workspace not initialized yet — Home falls back to the onboarding state.
    projectId = null;
  }

  let knowledgeBases: HomeData["knowledgeBases"] = [];
  let conversations: HomeData["conversations"] = [];
  let sources: HomeData["sources"] = [];
  let artifacts: HomeData["artifacts"] = [];
  let studies: HomeData["studies"] = { quizzesTaken: 0, cardsKnown: 0 };
  let loadError = false;

  try {
    knowledgeBases = await listKnowledgeBases();

    if (projectId && session?.user?.id) {
      [conversations, sources, artifacts, studies] = await Promise.all([
        prisma.conversation.findMany({
          where: { userId: session.user.id, knowledgeBase: { projectId } },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            knowledgeBaseId: true,
            knowledgeBase: { select: { name: true } },
          },
        }),
        prisma.document.findMany({
          where: { knowledgeBase: { projectId } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 6,
          select: {
            id: true,
            name: true,
            status: true,
            knowledgeBaseId: true,
            knowledgeBase: { select: { name: true } },
          },
        }),
        prisma.learningArtifact.findMany({
          where: { knowledgeBase: { projectId } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            createdAt: true,
            knowledgeBaseId: true,
            knowledgeBase: { select: { name: true } },
          },
        }),
        getStudyCountsForProject(session.user.id, projectId),
      ]);
    }
  } catch {
    // Keep whatever succeeded and flag the page; HomeView renders an error note.
    loadError = true;
  }

  return (
    <HomeView
      data={{
        userName: session?.user?.name ?? null,
        knowledgeBases,
        conversations,
        sources,
        artifacts,
        studies,
        loadError,
      }}
    />
  );
}
