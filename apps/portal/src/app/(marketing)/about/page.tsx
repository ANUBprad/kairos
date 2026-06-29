import type { Metadata } from "next";
import Link from "next/link";
import { Brain, GitBranch, Target, Eye } from "lucide-react";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal, StaggerContainer } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "About",
  description: "Kairos is building the adaptive retrieval layer for AI applications.",
};

const values = [
  {
    icon: Brain,
    title: "Intelligence",
    desc: "Every interaction feels smart. The system understands context, learns from feedback, and makes decisions that a human engineer would be proud of.",
  },
  {
    icon: GitBranch,
    title: "Adaptability",
    desc: "Nothing is rigid. The product molds to each query, each user, each use case. One strategy for everything is never the right answer.",
  },
  {
    icon: Target,
    title: "Precision",
    desc: "Every decision is deliberate. Every result is measured. Every improvement is tracked and validated with statistical rigor.",
  },
  {
    icon: Eye,
    title: "Clarity",
    desc: "Complex technology, simple experience. Users understand what's happening and why. No black boxes, no mystery, no surprises.",
  },
];

export default function AboutPage() {
  return (
    <>
      <div className="pt-28 pb-8 text-center px-6 sm:px-8">
        <ScrollReveal>
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">
            About Kairos
          </h1>
          <p className="mt-4 text-[18px] text-text-secondary max-w-2xl mx-auto">
            Building the adaptive retrieval layer for AI applications.
          </p>
        </ScrollReveal>
      </div>

      <SectionWrapper>
        <ScrollReveal className="max-w-3xl mx-auto">
          <h2 className="text-[24px] font-semibold text-text-primary mb-5">Our Mission</h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Kairos was founded to solve a simple problem: every query is different, but every retrieval system treats them the same. Simple questions like "What's our refund policy?" need a fast keyword lookup. Complex questions like "Compare Q1 and Q3 revenue and explain the variance" need multi-hop reasoning across documents.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Traditional retrieval systems apply the same strategy to both — wasting money on simple queries and failing on complex ones. We believe retrieval should be as intelligent as the questions it answers.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Kairos is an adaptive retrieval intelligence platform that classifies every query individually, selects the optimal strategy, and allocates compute budget proportional to difficulty. The result: 24% better recall at 40% lower cost, with full observability into every decision.
          </p>
        </ScrollReveal>
      </SectionWrapper>

      <SectionWrapper>
        <ScrollReveal className="text-center">
          <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-tight text-text-primary">Our Values</h2>
          <p className="mt-3 text-[16px] text-text-secondary max-w-2xl mx-auto">
            The principles that guide every decision we make.
          </p>
        </ScrollReveal>
        <StaggerContainer className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4" staggerDelay={0.08}>
          {values.map((value) => {
            const Icon = value.icon;
            return (
              <Card key={value.title} className="border-border/60">
                <Icon size={18} className="text-brand mb-3" />
                <h3 className="text-sm font-semibold text-text-primary mb-1.5">{value.title}</h3>
                <p className="text-xs text-text-tertiary leading-relaxed">{value.desc}</p>
              </Card>
            );
          })}
        </StaggerContainer>
      </SectionWrapper>

      <div className="text-center py-20 px-6 sm:px-8">
        <ScrollReveal>
          <h2 className="text-[28px] font-semibold text-text-primary mb-4">
            Join us in building the future of retrieval
          </h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            We&apos;re looking for engineers who believe retrieval should be as intelligent as the questions it answers.
          </p>
          <Button variant="primary" size="lg" asChild>
            <Link href="/contact">Get in Touch</Link>
          </Button>
        </ScrollReveal>
      </div>
    </>
  );
}
