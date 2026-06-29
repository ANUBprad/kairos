"use client";

import { X, Check } from "lucide-react";
import { SectionWrapper, SectionHeading } from "./section-wrapper";
import { Card } from "@/components/ui/card";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export function Problem() {
  return (
    <SectionWrapper id="problem">
      <ScrollReveal>
        <SectionHeading>
          One retriever for every query? That&apos;s the problem.
        </SectionHeading>
      </ScrollReveal>

      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScrollReveal direction="left">
          <Card className="border border-error/20 h-full">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-error/10">
                <X size={14} className="text-error" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Static RAG</span>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  &ldquo;What&apos;s our refund policy?&rdquo;
                </p>
                <div className="text-xs text-text-tertiary space-y-1">
                  <p className="text-error/60 line-through">Full dense search (slow, expensive)</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  &ldquo;Compare Q1 vs Q3 revenue&rdquo;
                </p>
                <div className="text-xs text-text-tertiary space-y-1">
                  <p className="text-error/60 line-through">Same dense search (misses connections)</p>
                </div>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-error font-medium">
                  Wastes money on simple queries. Fails on complex ones.
                </p>
              </div>
            </div>
          </Card>
        </ScrollReveal>

        <ScrollReveal direction="right">
          <Card className="border border-success/20 h-full">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-success/10">
                <Check size={14} className="text-success" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Kairos Adaptive</span>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  &ldquo;What&apos;s our refund policy?&rdquo;
                </p>
                <div className="text-xs space-y-1">
                  <p className="text-success">Simple keyword search (2ms, $0.002)</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  &ldquo;Compare Q1 vs Q3 revenue&rdquo;
                </p>
                <div className="text-xs space-y-1">
                  <p className="text-success">Multi-hop reasoning (3 hops, 1.2s, $0.021)</p>
                </div>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-success font-medium">
                  Right strategy every time. 24% better recall. 18% less cost.
                </p>
              </div>
            </div>
          </Card>
        </ScrollReveal>
      </div>

      <ScrollReveal className="mt-12 text-center">
        <p className="text-xl font-semibold text-text-primary">
          Static retrieval doesn&apos;t understand the query. Kairos does.
        </p>
      </ScrollReveal>
    </SectionWrapper>
  );
}
