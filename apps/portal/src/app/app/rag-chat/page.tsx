import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { RagChat } from "./rag-chat-client";

export const metadata = {
  title: "RAG Chat | Kairos",
};

export default async function RagChatPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { ensureDefaultOrg } = await import("@/lib/server/organization");
  const { project } = await ensureDefaultOrg();

  const kbs = await prisma.knowledgeBase.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return <RagChat kbs={kbs} />;
}
