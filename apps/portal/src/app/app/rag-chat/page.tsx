import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import { RagChat } from "./rag-chat-client";

export const metadata = {
  title: "RAG Chat | Kairos",
};

export default async function RagChatPage() {
  await requireSession();

  const { ensureDefaultOrg } = await import("@/lib/server/organization");
  const { project } = await ensureDefaultOrg();

  const kbs = await prisma.knowledgeBase.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return <RagChat kbs={kbs} />;
}
