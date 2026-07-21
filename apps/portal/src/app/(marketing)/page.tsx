import type { Metadata } from "next";
import { Hero } from "@/components/marketing/sections/hero-section";
import { UploadSection } from "@/components/marketing/sections/upload-section";
import { ExtractionSection } from "@/components/marketing/sections/extraction-section";
import { ChunkingSection } from "@/components/marketing/sections/chunking-section";
import { EmbeddingsSection } from "@/components/marketing/sections/embeddings-section";
import { RetrievalSection } from "@/components/marketing/sections/retrieval-section";
import { RerankingSection } from "@/components/marketing/sections/reranking-section";
import { GenerationSection } from "@/components/marketing/sections/generation-section";
import { EvaluationSection } from "@/components/marketing/sections/evaluation-section";
import { ArchitectureSection } from "@/components/marketing/sections/architecture-section";
import { FinalCTASection } from "@/components/marketing/sections/final-cta-section";
import { ScrollProgress } from "@/components/marketing/scroll-progress";
import { SectionNav } from "@/components/marketing/section-nav";

export const metadata: Metadata = {
  title: "Kairos — Explainable RAG Research Platform",
  description:
    "Upload documents, experiment with retrieval strategies, evaluate with statistical rigor. Understand why your RAG system works — or why it doesn't.",
};

export default function HomePage() {
  return (
    <>
      <ScrollProgress />
      <SectionNav />
      <Hero />
      <UploadSection />
      <ExtractionSection />
      <ChunkingSection />
      <EmbeddingsSection />
      <RetrievalSection />
      <RerankingSection />
      <GenerationSection />
      <EvaluationSection />
      <ArchitectureSection />
      <FinalCTASection />
    </>
  );
}
