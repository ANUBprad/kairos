"use client";

import { motion } from "framer-motion";
import {
  GitBranch,
  Gauge,
  DollarSign,
  RefreshCw,
  BarChart3,
  Plug,
  Layers,
  Shield,
} from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { StaggerContainer, staggerItem, ScrollReveal } from "@/components/shared/scroll-reveal";

const features = [
  {
    icon: GitBranch,
    title: "Adaptive Routing",
    desc: "Every query is classified by complexity and routed to the optimal retrieval strategy — simple keyword search, dense vector retrieval, or multi-hop reasoning.",
  },
  {
    icon: Gauge,
    title: "Confidence Calibration",
    desc: "Every answer includes a calibrated confidence score. Know exactly how reliable each response is, with statistically validated calibration curves.",
  },
  {
    icon: DollarSign,
    title: "Budget Optimization",
    desc: "An ML model allocates compute budget proportional to query difficulty. Simple queries cost pennies. Complex queries get the resources they need.",
  },
  {
    icon: RefreshCw,
    title: "Feedback Learning",
    desc: "Thumbs up or down on any answer. Those signals retrain the strategy selector and budget optimizer, making the system smarter with every query.",
  },
  {
    icon: BarChart3,
    title: "Full Observability",
    desc: "Per-query latency, confidence, cost, and strategy breakdown. Every decision instrumented and visible in your dashboard.",
  },
  {
    icon: Plug,
    title: "Provider Agnostic",
    desc: "Works with any LLM, any vector store, and any embedding model. No vendor lock-in, ever.",
  },
  {
    icon: Layers,
    title: "Multi-Strategy Engine",
    desc: "Three built-in retrieval strategies — hybrid, MMR with cross-encoder rerank, and iterative multi-hop — each optimized for different query types.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "API keys hashed with SHA-256, TLS 1.3 in transit, AES-256 at rest. SOC 2 compliant. Self-hostable for air-gapped environments.",
  },
  {
    icon: GitBranch,
    title: "Semantic Caching",
    desc: "Intelligent caching layer that serves semantically similar queries from cache, reducing latency by up to 60% for repeat question patterns.",
  },
];

export function FeaturesGrid() {
  return (
    <SectionWrapper id="features">
      <ScrollReveal>
        <SectionHeading>Everything you need, nothing you don&apos;t</SectionHeading>
        <SectionSubheading>
          Production-grade retrieval infrastructure without the assembly required.
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
