import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FileSearch,
  Scissors,
  FlaskConical,
  Bot,
  BarChart3,
  BookOpen,
  ArrowRight,
  Database,
  Layers,
  Cpu,
} from "lucide-react";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";

export default async function AppPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { ensureDefaultOrg } = await import("@/lib/server/organization");
  const { project } = await ensureDefaultOrg();

  const [knowledgeBases, docCount, chunkCount, experimentCount] = await Promise.all([
    listKnowledgeBases(),
    prisma.document.count({
      where: { knowledgeBase: { projectId: project.id } },
    }),
    prisma.documentChunk.count({
      where: { document: { knowledgeBase: { projectId: project.id } } },
    }),
    prisma.experimentRun.count({
      where: { knowledgeBase: { projectId: project.id } },
    }),
  ]);

  const pipelineStages = [
    {
      title: "Document Ingestion",
      description: "Upload and extract text from PDF, DOCX, CSV, Markdown files",
      href: "/app/knowledge-bases",
      icon: FileSearch,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      title: "Chunking",
      description: "Split documents into manageable pieces using configurable strategies",
      href: "/app/chunking-studio",
      icon: Scissors,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      title: "Embedding & Retrieval",
      description: "Generate vector embeddings and search semantically",
      href: "/app/retrieval-lab",
      icon: FlaskConical,
      color: "text-brand",
      bg: "bg-brand/10",
    },
    {
      title: "RAG Chat",
      description: "Query documents with explainable, cited responses",
      href: "/app/rag-chat",
      icon: Bot,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Evaluation",
      description: "Measure retrieval quality and system performance",
      href: "/app/evaluation",
      icon: BarChart3,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Research Overview</h1>
        <p className="mt-1 text-sm text-text-secondary max-w-2xl">
          Kairos is an experimental platform for studying Retrieval-Augmented Generation (RAG).
          Explore each stage of the pipeline below.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary mb-2">
            <BookOpen size={14} />
            Knowledge Bases
          </div>
          <p className="text-2xl font-semibold text-text-primary font-mono">{knowledgeBases.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary mb-2">
            <FileSearch size={14} />
            Documents
          </div>
          <p className="text-2xl font-semibold text-text-primary font-mono">{docCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary mb-2">
            <Layers size={14} />
            Chunks
          </div>
          <p className="text-2xl font-semibold text-text-primary font-mono">{chunkCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary mb-2">
            <BarChart3 size={14} />
            Experiments
          </div>
          <p className="text-2xl font-semibold text-text-primary font-mono">{experimentCount}</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">RAG Pipeline</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {pipelineStages.map((stage) => {
            const Icon = stage.icon;
            return (
              <Link
                key={stage.href}
                href={stage.href}
                className="group rounded-xl border border-border bg-surface p-5 transition-all hover:border-brand/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stage.bg}`}>
                    <Icon className={`h-5 w-5 ${stage.color}`} />
                  </div>
                  <ArrowRight size={16} className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                </div>
                <h3 className="mt-4 text-sm font-medium text-text-primary">{stage.title}</h3>
                <p className="mt-1 text-xs text-text-secondary">{stage.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-3">What is RAG?</h2>
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            <strong className="text-text-primary">Retrieval-Augmented Generation (RAG)</strong> is an AI architecture
            that combines information retrieval with text generation. Instead of relying solely on a model&apos;s
            parametric knowledge, RAG retrieves relevant documents from a knowledge base and provides them as context
            to the language model.
          </p>
          <p className="text-xs text-text-tertiary border-l-2 border-brand/30 pl-3 py-1">
            RAG addresses key limitations of large language models: hallucination, stale knowledge, and lack of
            source transparency. By grounding responses in retrieved documents, RAG systems can cite sources and
            provide verifiable answers.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-3">Technology Stack</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
              <Database size={12} />
              Vector Database
            </div>
            <p className="text-sm text-text-primary">PostgreSQL + pgvector</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
              <Cpu size={12} />
              Embedding Models
            </div>
            <p className="text-sm text-text-primary">OpenAI / Gemini (configurable)</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
              <Layers size={12} />
              Chunking Strategies
            </div>
            <p className="text-sm text-text-primary">5 configurable strategies</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
              <Bot size={12} />
              LLM Providers
            </div>
            <p className="text-sm text-text-primary">OpenAI GPT-4 / Gemini</p>
          </div>
        </div>
      </div>

      {knowledgeBases.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Knowledge Bases</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {knowledgeBases.slice(0, 6).map((kb) => (
              <Link
                key={kb.id}
                href={`/app/knowledge-bases/${kb.id}`}
                className="rounded-lg border border-border bg-surface/50 p-4 transition-colors hover:bg-surface-hover"
              >
                <p className="text-sm font-medium text-text-primary truncate">{kb.name}</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {kb._count.documents} documents
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
