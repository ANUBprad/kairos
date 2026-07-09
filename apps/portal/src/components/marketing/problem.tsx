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
          Black-box RAG systems cannot be trusted. Kairos makes them explainable.
        </SectionHeading>
      </ScrollReveal>

      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScrollReveal direction="left">
          <Card className="border border-error/20 h-full">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/60">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-error/10">
                <X size={14} className="text-error" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Black-Box RAG</span>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  &ldquo;Why did the system return this answer?&rdquo;
                </p>
                <div className="text-xs text-text-tertiary space-y-1">
                  <p className="text-error/60">No visibility into which chunks were retrieved</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  &ldquo;Is this configuration actually better?&rdquo;
                </p>
                <div className="text-xs text-text-tertiary space-y-1">
                  <p className="text-error/60">Single metrics without confidence intervals</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  &ldquo;Why was this chunk not retrieved?&rdquo;
                </p>
                <div className="text-xs text-text-tertiary space-y-1">
                  <p className="text-error/60">No debugging tools for retrieval failures</p>
                </div>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-error font-medium">
                  You cannot improve what you cannot see.
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
              <span className="text-sm font-semibold text-text-primary">Kairos Explainable</span>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  Full pipeline trace per query
                </p>
                <div className="text-xs space-y-1">
                  <p className="text-success">Every chunk, similarity score, and latency visible</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  Statistical comparison with p-values
                </p>
                <div className="text-xs space-y-1">
                  <p className="text-success">Confidence intervals, effect sizes, significance tests</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  Retrieval debugger with why-not-retrieved analysis
                </p>
                <div className="text-xs space-y-1">
                  <p className="text-success">Inspect why specific chunks were missed</p>
                </div>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-success font-medium">
                  See every decision. Understand every result. Trust the system.
                </p>
              </div>
            </div>
          </Card>
        </ScrollReveal>
      </div>

      <ScrollReveal className="mt-12 text-center">
        <p className="text-xl font-semibold text-text-primary">
          A RAG system that cannot explain itself is not a research tool. It is a guess.
        </p>
      </ScrollReveal>
    </SectionWrapper>
  );
}
