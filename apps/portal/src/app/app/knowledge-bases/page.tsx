import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { KnowledgeBaseList } from "@/components/app/knowledge-base-list";

export const metadata = {
  title: "Knowledge Bases",
};

export default async function KnowledgeBasesPage() {
  try {
    const knowledgeBases = await listKnowledgeBases();

    return <KnowledgeBaseList items={knowledgeBases} />;
  } catch {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">Error loading knowledge bases</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Please try refreshing the page. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }
}
