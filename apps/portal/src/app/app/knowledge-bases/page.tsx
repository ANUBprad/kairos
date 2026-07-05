import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { KnowledgeBaseList } from "@/components/app/knowledge-base-list";

export default async function KnowledgeBasesPage() {
  const knowledgeBases = await listKnowledgeBases();

  return <KnowledgeBaseList items={knowledgeBases} />;
}
