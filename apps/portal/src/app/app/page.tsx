import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { KnowledgeBaseList } from "@/components/app/knowledge-base-list";

export default async function AppPage() {
  const knowledgeBases = await listKnowledgeBases();

  return <KnowledgeBaseList items={knowledgeBases} />;
}
