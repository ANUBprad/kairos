"use client";

import { motion } from "framer-motion";
import { ArrowRight, RotateCcw } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { Card } from "@/components/ui/card";
import { ScrollReveal, StaggerContainer, staggerItem } from "@/components/shared/scroll-reveal";

const steps = [
  {
    num: "1",
    title: "Classify",
    desc: "LLM analyzes query complexity in milliseconds",
  },
  {
    num: "2",
    title: "Select Strategy",
    desc: "Budget allocator chooses the optimal approach",
  },
  {
    num: "3",
    title: "Retrieve & Answer",
    desc: "Best retriever executes with confidence calibration",
  },
];

export function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works">
      <ScrollReveal>
        <SectionHeading>How Kairos Works</SectionHeading>
        <SectionSubheading>
          One API call. Three retrieval strategies. Optimal results every time.
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

      <ScrollReveal className="mt-10 mx-auto max-w-xl">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4 border-l-4 border-l-brand/60">
          <RotateCcw size={16} className="text-brand mt-0.5 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-text-primary">Fallback built-in: </span>
            <span className="text-xs text-text-tertiary">
              If confidence falls below threshold, Kairos automatically falls back to a
              safer strategy &mdash; never leaving your question unanswered.
            </span>
          </div>
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
