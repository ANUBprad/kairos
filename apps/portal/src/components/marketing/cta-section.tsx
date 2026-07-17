"use client";

import Link from "next/link";
import { ArrowRight, Eye, FlaskConical, BarChart3 } from "lucide-react";
import { SectionWrapper, SectionHeading } from "./section-wrapper";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { Button } from "@/components/ui/button";

const useCases = [
  {
    icon: FlaskConical,
    title: "For Researchers",
    description: "Run controlled experiments, compare strategies with statistical rigor, generate academic reports. Every claim backed by data.",
  },
  {
    icon: Eye,
    title: "For Engineers",
    description: "Debug retrieval failures, inspect pipeline traces, understand why specific chunks were retrieved or missed. Build trustworthy RAG systems.",
  },
  {
    icon: BarChart3,
    title: "For Students",
    description: "Learn RAG concepts by doing. Upload documents, experiment with configurations, see how chunking and embedding choices affect results.",
  },
];

export function CTASection() {
  return (
    <SectionWrapper id="cta">
      <ScrollReveal>
        <SectionHeading>Who is Kairos for?</SectionHeading>
      </ScrollReveal>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {useCases.map((uc) => {
          const Icon = uc.icon;
          return (
            <ScrollReveal key={uc.title}>
              <div className="rounded-xl border border-border bg-surface/50 p-6 text-center">
                <Icon size={24} className="text-brand mx-auto mb-4" />
                <h3 className="text-sm font-semibold text-text-primary mb-2">{uc.title}</h3>
                <p className="text-xs text-text-tertiary leading-relaxed">{uc.description}</p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      <ScrollReveal className="mt-16 text-center">
        <h2 className="text-[28px] font-semibold text-text-primary mb-4">
          Start building transparent AI
        </h2>
        <p className="text-text-secondary mb-8 max-w-md mx-auto">
          Upload documents, run retrieval tests, and evaluate with statistical rigor.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" asChild>
            <Link href="/app">
              Explore Platform <ArrowRight size={16} />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/features">
              Explore Features
            </Link>
          </Button>
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
