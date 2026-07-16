import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/app/chat-interface";

interface Props {
  params: Promise<{ kbId: string }>;
}

export default async function ChatPage({ params }: Props) {
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
}
