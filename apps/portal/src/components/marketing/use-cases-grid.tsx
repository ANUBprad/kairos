"use client";

import { HeadphonesIcon, Search, FileText, Scale } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { StaggerContainer, staggerItem, ScrollReveal } from "@/components/shared/scroll-reveal";
import { motion } from "framer-motion";

const useCases = [
  {
    icon: HeadphonesIcon,
    title: "AI-Powered Support",
    desc: "Route customer queries to the right knowledge base with adaptive retrieval. Simple FAQs get fast keyword lookups. Complex issues get multi-hop reasoning across documentation.",
  },
  {
    icon: Search,
    title: "Internal Knowledge Search",
    desc: "Connect your company wikis, runbooks, and policies. Kairos adapts to each search — quick reference or deep research — without manual tuning.",
  },
  {
    icon: FileText,
    title: "Research Synthesis",
    desc: "Aggregate findings across papers, reports, and databases. Multi-hop retrieval connects related insights that single-pass search would miss.",
  },
  {
    icon: Scale,
    title: "Compliance Analysis",
    desc: "Query regulatory documents with confidence. Kairos provides calibrated confidence scores and cited sources, making audit trails straightforward.",
  },
];

export function UseCasesGrid() {
  return (
    <SectionWrapper id="use-cases">
      <ScrollReveal>
        <SectionHeading>Built for real-world retrieval</SectionHeading>
        <SectionSubheading>
          From support to compliance, Kairos adapts to how you need to search.
        </SectionSubheading>
      </ScrollReveal>

      <StaggerContainer className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-4" staggerDelay={0.1}>
        {useCases.map((uc) => {
          const Icon = uc.icon;
          return (
            <motion.div
              key={uc.title}
              variants={staggerItem()}
              className="group rounded-[14px] border border-border bg-surface/50 p-6 transition-all duration-300 hover:-translate-y-[2px] hover:border-brand/20 hover:bg-surface hover:shadow-lg"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-brand/10 mb-4 group-hover:bg-brand/15 transition-colors">
                <Icon size={18} className="text-brand" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">{uc.title}</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">{uc.desc}</p>
            </motion.div>
          );
        })}
      </StaggerContainer>
    </SectionWrapper>
  );
}
