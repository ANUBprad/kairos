import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/app/chat-interface";

export const metadata = {
  title: "Knowledge Base Chat",
};

interface Props {
  params: Promise<{ kbId: string }>;
}

export default async function ChatPage({ params }: Props) {
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

    const documents = await prisma.document.findMany({
      where: { knowledgeBaseId: kbId, status: "INDEXED" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return <ChatInterface kbId={kbId} kbName={kb.name} documents={documents} />;
  } catch {
    redirect("/app");
  }
}
