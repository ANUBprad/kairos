import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/app/chat-interface";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { getServerSession } from "@/lib/server/auth-utils";
import { isValidEntityId } from "@/lib/validation";

export const metadata = {
  title: "Knowledge Base Chat",
};

interface Props {
  params: Promise<{ kbId: string }>;
  searchParams: Promise<{ conversation?: string | string[] }>;
}

export default async function ChatPage({ params, searchParams }: Props) {
  try {
    const { kbId } = await params;
    const sp = await searchParams;
    const conversationId =
      typeof sp.conversation === "string" && isValidEntityId(sp.conversation)
        ? sp.conversation
        : undefined;

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

    const session = await getServerSession();
    if (!session?.user?.id || !(await canAccessKnowledgeBase(session.user.id, kbId))) {
      redirect("/app");
    }

    const documents = await prisma.document.findMany({
      where: { knowledgeBaseId: kbId, status: "INDEXED" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return <ChatInterface kbId={kbId} kbName={kb.name} documents={documents} initialConversationId={conversationId} />;
  } catch {
    redirect("/app");
  }
}
