import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch, Gauge, DollarSign, RefreshCw, BarChart3, Plug, Layers, Shield } from "lucide-react";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Button } from "@/components/ui/button";
import { ScrollReveal, StaggerContainer } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Features",
  description: "Kairos adaptive retrieval platform features: adaptive routing, confidence calibration, budget optimization, feedback learning, observability, and enterprise security.",
};

const features = [
  {
    icon: GitBranch,
    title: "Adaptive Routing",
    desc: "Every query is classified by complexity and routed to the optimal retrieval strategy — simple keyword search, dense vector retrieval, or multi-hop reasoning across documents.",
  },
  {
    icon: Gauge,
    title: "Confidence Calibration",
    desc: "Every answer includes a calibrated confidence score using Platt scaling and isotonic regression. Know exactly how reliable each response is.",
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
    desc: "Per-query latency, confidence, cost, and strategy breakdown. Every decision is instrumented and visible in your dashboard.",
  },
  {
    icon: Plug,
    title: "Provider Agnostic",
    desc: "Works with any LLM (OpenAI, Gemini, Claude, Groq, Ollama), any vector store, and any embedding model. No vendor lock-in.",
  },
  {
    icon: Layers,
    title: "Multi-Strategy Engine",
    desc: "Three built-in retrieval strategies — hybrid keyword+vector, MMR with cross-encoder rerank, and iterative multi-hop reasoning.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "API keys hashed with SHA-256, TLS 1.3 in transit, AES-256 at rest. SOC 2 compliant. Self-hostable for air-gapped environments.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <div className="pt-28 pb-8 text-center px-6 sm:px-8">
        <ScrollReveal>
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">Features</h1>
          <p className="mt-4 text-[18px] text-text-secondary max-w-2xl mx-auto">
            Everything you need to build production-grade retrieval for your AI applications.
          </p>
        </ScrollReveal>
      </div>

      <SectionWrapper>
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4" staggerDelay={0.06}>
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-[14px] border border-border bg-surface/50 p-6 transition-all duration-300 hover:-translate-y-[2px] hover:border-brand/20 hover:bg-surface hover:shadow-lg"
              >
                <Icon size={18} className="text-brand mb-3" />
                <h3 className="text-sm font-semibold text-text-primary mb-1.5">{feature.title}</h3>
                <p className="text-xs text-text-tertiary leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </StaggerContainer>
      </SectionWrapper>

      <div className="text-center py-20 px-6 sm:px-8">
        <ScrollReveal>
          <h2 className="text-[24px] font-semibold text-text-primary mb-4">Ready to try adaptive retrieval?</h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">Start free. No credit card required.</p>
          <Button variant="primary" size="lg" asChild>
            <Link href="/signup">Start building</Link>
          </Button>
        </ScrollReveal>
      </div>
    </>
  );
}
