import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { DocumentTable } from "@/components/app/document-table";
import { listDocuments } from "@/lib/actions/document";

interface Props {
  params: Promise<{ kbId: string }>;
}

export default async function KnowledgeBasePage({ params }: Props) {
  const session = await requireSession();

  const { kbId } = await params;

  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: {
      id: true,
      name: true,
      project: {
        select: {
          organization: {
            select: {
              members: {
                where: { userId: session.user.id },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!kb || kb.project.organization.members.length === 0) {
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
