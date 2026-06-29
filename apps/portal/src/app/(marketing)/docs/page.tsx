import type { Metadata } from "next";
import Link from "next/link";
import { Book, Terminal, Cpu, FileJson } from "lucide-react";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { CardInteractive } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal, StaggerContainer } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Kairos API documentation, SDKs, tutorials, and reference guides.",
};

const sections = [
  {
    icon: Book,
    title: "Getting Started",
    desc: "Quickstart guide, installation, and your first query in under 5 minutes.",
  },
  {
    icon: Terminal,
    title: "API Reference",
    desc: "Complete API documentation for the Kairos query, ingestion, and management endpoints.",
  },
  {
    icon: FileJson,
    title: "SDKs & Clients",
    desc: "Official Python and TypeScript SDKs with examples, type definitions, and best practices.",
  },
  {
    icon: Cpu,
    title: "Architecture",
    desc: "Understanding the adaptive pipeline: classifier, planner, budget optimizer, retriever, and judge.",
  },
  {
    icon: Book,
    title: "Tutorials",
    desc: "Step-by-step guides for common use cases: customer support, research, compliance, and more.",
  },
  {
    icon: Terminal,
    title: "Integrations",
    desc: "Connect Kairos with your LLM provider, vector store, and observability stack.",
  },
];

export default function DocsPage() {
  return (
    <div className="pt-28 pb-24">
      <div className="mx-auto max-w-[800px] px-6 sm:px-8 text-center">
        <ScrollReveal>
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">Documentation</h1>
          <p className="mt-4 text-[18px] text-text-secondary">Everything you need to integrate Kairos into your application.</p>
        </ScrollReveal>
      </div>

      <SectionWrapper>
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4" staggerDelay={0.08}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <CardInteractive key={section.title} className="border-l-2 border-l-transparent hover:border-l-brand/50">
                <Icon size={18} className="text-brand mb-3" />
                <h3 className="text-sm font-semibold text-text-primary mb-1.5">{section.title}</h3>
                <p className="text-xs text-text-tertiary leading-relaxed">{section.desc}</p>
              </CardInteractive>
            );
          })}
        </StaggerContainer>
      </SectionWrapper>

      <div className="text-center py-16 px-6 sm:px-8">
        <ScrollReveal>
          <h2 className="text-[24px] font-semibold text-text-primary mb-4">Ready to start building?</h2>
          <p className="text-text-secondary mb-8">Get your first query running in under 5 minutes.</p>
          <Button variant="primary" size="lg" asChild>
            <Link href="/signup">Start building</Link>
          </Button>
        </ScrollReveal>
      </div>
    </div>
  );
}
