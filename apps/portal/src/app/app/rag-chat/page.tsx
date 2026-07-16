import dynamic from "next/dynamic";
import { prisma } from "@/lib/prisma";

const RagChat = dynamic(() => import("./rag-chat-client").then((m) => m.RagChat), {
  loading: () => <div className="animate-pulse bg-surface rounded-lg h-96" />,
});

export const metadata = {
  title: "RAG Chat",
};

export default async function RagChatPage() {
  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const { project } = await ensureDefaultOrg();

    const kbs = await prisma.knowledgeBase.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });

    return <RagChat kbs={kbs} />;
  } catch {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">Error loading RAG chat</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Please try refreshing the page. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }
}
