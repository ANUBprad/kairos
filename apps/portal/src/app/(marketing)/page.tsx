import type { Metadata } from "next";
import { Hero } from "@/components/marketing/sections/hero-section";
import { WorkflowSection } from "@/components/marketing/sections/workflow-section";
import { ArtifactsSection } from "@/components/marketing/sections/artifacts-section";
import { FinalCTASection } from "@/components/marketing/sections/final-cta-section";

export const metadata: Metadata = {
  title: "Kairos — Bring your sources. Understand them. Create from them. Learn them.",
  description:
    "Kairos is a research workspace: upload your sources, ask grounded questions with citations, turn them into summaries, quizzes, and flashcards, and study to actually keep the knowledge.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <WorkflowSection />
      <ArtifactsSection />
      <FinalCTASection />
    </>
  );
}