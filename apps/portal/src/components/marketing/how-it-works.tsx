"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { Card } from "@/components/ui/card";
import { ScrollReveal, StaggerContainer, staggerItem } from "@/components/shared/scroll-reveal";

const steps = [
  {
    num: "1",
    title: "Upload Documents",
    desc: "PDF, DOCX, CSV, or Markdown. Automatic text extraction and chunking.",
  },
  {
    num: "2",
    title: "Generate Embeddings",
    desc: "Choose OpenAI or Gemini models. Store vectors in pgvector.",
  },
  {
    num: "3",
    title: "Search & Retrieve",
    desc: "Semantic search with citations, similarity scores, and provenance.",
  },
];

export function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works">
      <ScrollReveal>
        <SectionHeading>How Kairos Works</SectionHeading>
        <SectionSubheading>
          Upload. Embed. Search. Three steps to production-grade RAG.
        </SectionSubheading>
      </ScrollReveal>

      <StaggerContainer className="mt-16 flex flex-col md:flex-row items-center justify-center gap-6" staggerDelay={0.12}>
        {steps.map((step, i) => (
          <motion.div key={step.num} variants={staggerItem()} className="flex items-center gap-4 md:gap-0">
            <Card className="w-full md:w-56 text-center py-8">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand/10 text-brand text-sm font-bold mx-auto mb-4">
                {step.num}
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1.5">{step.title}</h3>
              <p className="text-xs text-text-tertiary leading-relaxed max-w-[160px] mx-auto">{step.desc}</p>
            </Card>
            {i < steps.length - 1 && (
              <div className="hidden md:flex items-center">
                <ArrowRight size={18} className="text-text-tertiary/60" />
              </div>
            )}
          </motion.div>
        ))}
      </StaggerContainer>
    </SectionWrapper>
  );
}
