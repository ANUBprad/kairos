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

    return <ChatInterface kbId={kbId} kbName={kb.name} />;
  } catch {
    redirect("/app");
  }
}
