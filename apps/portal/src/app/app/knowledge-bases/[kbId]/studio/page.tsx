import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { listDocuments } from "@/lib/actions/document";
import { listLearningArtifactsForWorkspace } from "@/lib/actions/artifacts";
import { SummaryStudio } from "@/components/app/studio/summary-studio";

export const metadata = {
  title: "Studio | Knowledge Base",
};

interface Props {
  params: Promise<{ kbId: string }>;
}

export default async function StudioPage({ params }: Props) {
  try {
    const { kbId } = await params;

    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!kb) {
      redirect("/app");
    }

    const [sources, artifacts] = await Promise.all([
      listDocuments(kbId),
      listLearningArtifactsForWorkspace(kbId, { type: "SUMMARY" }),
    ]);

    return (
      <SummaryStudio
        kbId={kbId}
        kbName={kb.name}
        sources={sources}
        initialArtifacts={artifacts}
      />
    );
  } catch {
    redirect("/app");
  }
}