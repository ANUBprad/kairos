"use client";

import { motion } from "framer-motion";
import {
  Search,
  Eye,
  Layers,
  BarChart3,
  GitBranch,
  FlaskConical,
  Zap,
  Database,
  Lightbulb,
} from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { StaggerContainer, staggerItem, ScrollReveal } from "@/components/shared/scroll-reveal";

const features = [
  {
    icon: Eye,
    title: "Explainable Retrieval",
    desc: "Full pipeline trace per query. See which chunks were retrieved, why they matched, similarity scores, and prompt construction. No black boxes.",
  },
  {
    icon: GitBranch,
    title: "Multi-Strategy Retrieval",
    desc: "8+ strategies: vector, BM25, hybrid RRF, query expansion, multi-query, reranking, context compression. Compare side by side.",
  },
  {
    icon: BarChart3,
    title: "Statistical Evaluation",
    desc: "12+ metrics with confidence intervals, p-values, effect sizes, and distribution analysis. Know if improvements are real or noise.",
  },
  {
    icon: FlaskConical,
    title: "Benchmark Campaigns",
    desc: "Run multiple strategies against labeled datasets. Leaderboard with composite scores. Automated comparison reports.",
  },
  {
    icon: Layers,
    title: "Chunking Studio",
    desc: "5 chunking strategies with visual preview. Recursive, sentence, fixed-size, Markdown, and semantic chunking.",
  },
  {
    icon: Search,
    title: "Retrieval Lab",
    desc: "Interactive testing with real-time parameter adjustment. Debug why specific chunks were or were not retrieved.",
  },
  {
    icon: Zap,
    title: "Streaming Chat",
    desc: "Production-grade RAG chat with inline citations, similarity scores, and per-message pipeline traces.",
  },
  {
    icon: Database,
    title: "Research Intelligence",
    desc: "Automated pattern discovery, trend detection, root cause inference, and experiment suggestions from benchmark data.",
  },
  {
    icon: Lightbulb,
    title: "Evidence-Backed Recommendations",
    desc: "Every recommendation includes metrics, significance tests, confidence intervals, and explanations. Not guesses.",
  },
];

export function FeaturesGrid() {
  return (
    <SectionWrapper id="features">
      <ScrollReveal>
        <SectionHeading>Core Capabilities</SectionHeading>
        <SectionSubheading>
          An end-to-end research workbench for building, testing, and understanding RAG systems.
        </SectionSubheading>
      </ScrollReveal>

      <StaggerContainer className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.06}>
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              variants={staggerItem()}
              className="group rounded-[14px] border border-border bg-surface/50 p-6 transition-all duration-300 hover:-translate-y-[2px] hover:border-brand/30 hover:bg-surface hover:shadow-lg cursor-default"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-brand/10 mb-4 group-hover:bg-brand/15 transition-colors duration-300">
                <Icon size={18} className="text-brand" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">{feature.desc}</p>
            </motion.div>
          );
        })}
      </StaggerContainer>
    </SectionWrapper>
  );
}
