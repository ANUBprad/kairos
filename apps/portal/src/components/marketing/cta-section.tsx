"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export function CTASection() {
  return (
    <SectionWrapper className="text-center">
      <ScrollReveal>
        <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-tight text-text-primary max-w-3xl mx-auto leading-[1.2]">
          Start building your RAG pipelines.
        </h2>
        <p className="mt-5 text-[18px] text-text-secondary max-w-xl mx-auto">
          Upload documents, experiment with embeddings, and evaluate retrieval quality — all in one platform.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="primary" size="lg" className="gap-2" asChild>
            <Link href="/signup">
              Get started
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="#features">Explore features</Link>
          </Button>
        </div>
        <div className="mt-6 flex items-center justify-center gap-5 text-xs text-text-tertiary">
          <span>GitHub OAuth</span>
          <span className="w-1 h-1 rounded-full bg-text-tertiary/40" />
          <span>Open-source</span>
          <span className="w-1 h-1 rounded-full bg-text-tertiary/40" />
          <span>No credit card</span>
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
