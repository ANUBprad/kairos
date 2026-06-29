"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, ArrowRight, Sparkles } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

type FlowStep = "query" | "classify" | "plan" | "budget" | "retrieve" | "judge" | "answer";

const demoQueries = [
  { text: "What is our refund policy?", id: "refund" },
  { text: "Compare Q1 and Q3 revenue", id: "revenue" },
  { text: "Explain our compliance requirements", id: "compliance" },
];

interface DemoResult {
  answer: string;
  strategy: string;
  confidence: string;
  latency: string;
  cost: string;
}

const demoResults: Record<string, DemoResult> = {
  refund: {
    answer: "Customers may return items within 30 days of purchase. Refunds are processed within 5-7 business days to the original payment method. Exceptions apply to marked-down items.",
    strategy: "Hybrid",
    confidence: "0.94",
    latency: "163ms",
    cost: "$0.0145",
  },
  revenue: {
    answer: "Q1 revenue was $2.1M driven by new customer acquisition. Q3 revenue reached $3.4M (+62% QoQ) driven by enterprise expansion and upsells.",
    strategy: "Multi-Hop",
    confidence: "0.87",
    latency: "450ms",
    cost: "$0.032",
  },
  compliance: {
    answer: "Your data handling must comply with SOC 2 Type II, GDPR, and HIPAA. Encryption at rest (AES-256) and in transit (TLS 1.3) is required with quarterly audit logging.",
    strategy: "Complex",
    confidence: "0.91",
    latency: "280ms",
    cost: "$0.021",
  },
};

const stepLabels: Record<FlowStep, { label: string; desc: string }> = {
  query: { label: "Query", desc: "Analyzing input" },
  classify: { label: "Classifier", desc: "Detecting complexity" },
  plan: { label: "Planner", desc: "Selecting strategy" },
  budget: { label: "Budget", desc: "Allocating compute" },
  retrieve: { label: "Retriever", desc: "Fetching sources" },
  judge: { label: "Judge", desc: "Calibrating confidence" },
  answer: { label: "Answer", desc: "Generating response" },
};

const flowOrder: FlowStep[] = ["query", "classify", "plan", "budget", "retrieve", "judge", "answer"];

export function EngineVisualization() {
  const [query, setQuery] = useState("");
  const [currentStep, setCurrentStep] = useState<FlowStep | null>(null);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDemo = useCallback((queryId: string) => {
    setResult(null);
    setIsRunning(true);

    const runSteps = async () => {
      for (let i = 0; i < flowOrder.length; i++) {
        setCurrentStep(flowOrder[i]);
        await new Promise((r) => setTimeout(r, 300));
      }
      setResult(demoResults[queryId]);
      setIsRunning(false);
    };
    runSteps();
  }, []);

  const handleSubmit = useCallback(() => {
    const match = query.toLowerCase();
    if (match.includes("refund")) runDemo("refund");
    else if (match.includes("revenue") || match.includes("q1") || match.includes("q3")) runDemo("revenue");
    else if (match.includes("compliance") || match.includes("security")) runDemo("compliance");
  }, [query, runDemo]);

  const reset = useCallback(() => {
    setCurrentStep(null);
    setResult(null);
    setIsRunning(false);
    setQuery("");
  }, []);

  return (
    <SectionWrapper id="engine">
      <ScrollReveal>
        <SectionHeading>Watch Kairos decide in real time</SectionHeading>
        <SectionSubheading>
          Type a query below and watch Kairos classify, plan, and retrieve — all animated step by step.
        </SectionSubheading>
      </ScrollReveal>

      <ScrollReveal className="mt-10 mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Try a query..."
              disabled={isRunning}
              className="w-full h-11 pl-4 pr-11 rounded-[10px] border border-border bg-surface text-sm text-text-primary placeholder:text-text-tertiary/60 focus:border-brand/50 focus:ring-2 focus:ring-brand/10 outline-none transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!query || isRunning}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-[8px] bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-40"
              aria-label="Submit query"
            >
              <Search size={15} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {demoQueries.map((dq) => (
            <button
              key={dq.id}
              onClick={() => { setQuery(dq.text); runDemo(dq.id); }}
              disabled={isRunning}
              className="px-4 py-2 rounded-[8px] border border-border bg-surface/50 text-xs text-text-secondary hover:border-border-hover hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {dq.text}
            </button>
          ))}
        </div>

        <div className="hidden md:block">
          <div className="flex items-center justify-center gap-1">
            {flowOrder.map((step, i) => {
              const isActive = currentStep === step;
              const isPast = currentStep && flowOrder.indexOf(currentStep) > i;
              const isFuture = currentStep && flowOrder.indexOf(currentStep) < i;

              return (
                <div key={step} className="flex items-center">
                  <motion.div
                    animate={{
                      scale: isActive ? 1.05 : 1,
                      opacity: isPast ? 0.6 : isFuture ? 0.25 : 1,
                    }}
                    className={`px-3 py-2 rounded-[8px] border text-xs font-medium transition-all min-w-[88px] text-center ${
                      isActive
                        ? "border-brand/50 bg-brand/[0.06] text-brand"
                        : isPast
                        ? "border-success/20 bg-success/[0.04] text-success/80"
                        : "border-border bg-surface/30 text-text-tertiary"
                    }`}
                  >
                    <div className="font-semibold">{stepLabels[step].label}</div>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[10px] mt-0.5 text-text-tertiary/60"
                      >
                        {stepLabels[step].desc}
                      </motion.div>
                    )}
                    {isPast && (
                      <div className="flex justify-center mt-0.5">
                        <Check size={10} />
                      </div>
                    )}
                  </motion.div>
                  {i < flowOrder.length - 1 && (
                    <div className="mx-1 text-text-tertiary/30">
                      <ArrowRight size={13} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="md:hidden space-y-2">
          {flowOrder.map((step) => {
            const idx = flowOrder.indexOf(step);
            const currentIdx = currentStep ? flowOrder.indexOf(currentStep) : -1;
            return (
              <div
                key={step}
                className={`flex items-center justify-between px-4 py-3 rounded-[8px] border text-xs ${
                  idx === currentIdx
                    ? "border-brand/30 bg-brand/[0.04]"
                    : idx < currentIdx
                    ? "border-success/20 bg-success/[0.03]"
                    : "border-border bg-surface/30"
                }`}
              >
                <span className={idx <= currentIdx ? "text-text-primary" : "text-text-tertiary"}>
                  {stepLabels[step].label}
                </span>
                {idx === currentIdx && <Sparkles size={13} className="text-brand" />}
                {idx < currentIdx && <Check size={13} className="text-success" />}
              </div>
            );
          })}
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-8 p-6 rounded-xl border border-border bg-surface/60"
            >
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[11px] font-mono font-semibold px-2 py-1 rounded-[6px] bg-brand/10 text-brand">
                  {result.strategy}
                </span>
                <span className="text-[11px] font-mono px-2 py-1 rounded-[6px] bg-info/10 text-info">
                  {result.confidence} confidence
                </span>
                <span className="text-[11px] font-mono px-2 py-1 rounded-[6px] bg-surface text-text-tertiary">
                  {result.latency}
                </span>
                <span className="text-[11px] font-mono px-2 py-1 rounded-[6px] bg-surface text-text-tertiary">
                  {result.cost}
                </span>
              </div>

              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                {result.answer}
              </p>

              <button
                onClick={reset}
                className="text-xs text-brand hover:text-brand-hover transition-colors font-medium"
              >
                Try another query
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollReveal>
    </SectionWrapper>
  );
}
