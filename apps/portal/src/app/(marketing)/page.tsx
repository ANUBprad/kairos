import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { CTASection } from "@/components/marketing/cta-section";

export const metadata: Metadata = {
  title: "Kairos",
  description:
    "Open-source RAG research platform for document intelligence, embeddings, semantic search, and explainable AI.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <FeaturesGrid />
      <CTASection />
    </>
  );
}
