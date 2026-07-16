import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DocumentTable } from "@/components/app/document-table";
import { listDocuments } from "@/lib/actions/document";

interface Props {
  params: Promise<{ kbId: string }>;
}

export default async function KnowledgeBasePage({ params }: Props) {
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

  const documents = await listDocuments(kbId);

  return (
    <DocumentTable
      items={documents.map((d) => ({
        ...d,
        createdAt: new Date(d.createdAt),
      }))}
      kbId={kbId}
      kbName={kb.name}
    />
  );
}
