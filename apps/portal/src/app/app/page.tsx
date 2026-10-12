import { prisma } from "@/lib/prisma";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { getServerSession } from "@/lib/server/auth-utils";
import { getStudyCountsForProject, type StudyCounts } from "@/lib/study";
import { DashboardClient } from "@/components/app/dashboard/dashboard-client";

export default async function AppPage() {
  let project: { id: string } | null = null;

  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const result = await ensureDefaultOrg();
    if (result) project = result.project;
  } catch {
    // Seed data not yet initialized — render empty dashboard
  }

  let knowledgeBases: Awaited<ReturnType<typeof listKnowledgeBases>> = [];
  let docCount = 0;
  let artifactCount = 0;
  let conversationCount = 0;
  let studies: StudyCounts = { quizzesTaken: 0, cardsKnown: 0 };

  try {
    const session = project ? await getServerSession() : null;
    if (project && session?.user?.id) {
      [knowledgeBases, docCount, artifactCount, conversationCount, studies] =
        await Promise.all([
          listKnowledgeBases(),
          prisma.document.count({
            where: { knowledgeBase: { projectId: project.id } },
          }),
          prisma.learningArtifact.count({
            where: { knowledgeBase: { projectId: project.id } },
          }),
          prisma.conversation.count({
            where: {
              userId: session.user.id,
              knowledgeBase: { projectId: project.id },
            },
          }),
          getStudyCountsForProject(session.user.id, project.id),
        ]);
    }
  } catch {
    // Dashboard will render with empty/default data
  }

  return (
    <DashboardClient
      data={{
        knowledgeBases: knowledgeBases.map((kb) => ({
          id: kb.id,
          name: kb.name,
          _count: kb._count,
        })),
        docCount,
        artifactCount,
        conversationCount,
        quizzesTaken: studies.quizzesTaken,
        cardsKnown: studies.cardsKnown,
      }}
    />
  );
}