"use client";

import { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
} from "framer-motion";
import { BarChart3, TrendingUp, Timer, Shield, Activity, Target, Sparkles, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "./section-header";

const metrics = [
  { label: "Recall@10", value: 0.92, unit: "", icon: Target, color: "text-green-400", bg: "bg-green-500/10", description: "Relevant chunks found in top 10", confidence: "95% CI: [0.89, 0.95]" },
  { label: "MRR", value: 0.87, unit: "", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10", description: "Mean Reciprocal Rank", confidence: "95% CI: [0.83, 0.91]" },
  { label: "Precision@5", value: 0.78, unit: "", icon: CheckCircle2, color: "text-violet-400", bg: "bg-violet-500/10", description: "Correct chunks in top 5", confidence: "95% CI: [0.74, 0.82]" },
  { label: "nDCG@10", value: 0.89, unit: "", icon: Sparkles, color: "text-amber-400", bg: "bg-amber-500/10", description: "Normalized Discounted Cumulative Gain", confidence: "95% CI: [0.86, 0.92]" },
  { label: "Latency", value: 142, unit: "ms", icon: Timer, color: "text-teal-400", bg: "bg-teal-500/10", description: "Median retrieval time", confidence: "p95: 218ms" },
  { label: "Hallucination Rate", value: 0.02, unit: "", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", description: "Unsupported claims per answer", confidence: "95% CI: [0.01, 0.04]" },
  { label: "F1 Score", value: 0.85, unit: "", icon: Activity, color: "text-rose-400", bg: "bg-rose-500/10", description: "Harmonic mean of precision & recall", confidence: "95% CI: [0.82, 0.88]" },
  { label: "Statistical Sig.", value: 0.003, unit: "", icon: BarChart3, color: "text-brand", bg: "bg-brand/10", description: "p-value for hybrid vs pure vector", confidence: "n=1,247 queries" },
];

function AnimatedMetric({
  metric,
  index,
}: {
  metric: (typeof metrics)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [displayValue, setDisplayValue] = useState(0);
  const Icon = metric.icon;

  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const startTime = Date.now();
    let rafId: number;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(eased * metric.value);
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };
    const timeout = setTimeout(() => {
      rafId = requestAnimationFrame(animate);
    }, 200 + index * 100);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafId);
    };
  }, [isInView, metric.value, index]);

  const formatValue = (v: number) => {
    if (metric.unit === "ms") return `${Math.round(v)}`;
    if (metric.value < 0.1) return v.toFixed(3);
    return v.toFixed(2);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.4 }}
      className="rounded-xl border border-border/40 bg-surface/50 p-4 hover:border-border-hover transition-colors duration-200"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${metric.bg}`}>
          <Icon size={14} className={metric.color} />
        </div>
        <span className="text-xs font-semibold text-text-primary">{metric.label}</span>
      </div>
      <div className="mb-2">
        <span className={`text-2xl font-bold font-mono ${metric.color}`}>
          {formatValue(displayValue)}
        </span>
        {metric.unit && (
          <span className="text-xs text-text-tertiary ml-1">{metric.unit}</span>
        )}
      </div>
      <p className="text-[11px] text-text-tertiary leading-relaxed mb-2">
        {metric.description}
      </p>
      <div className="text-[10px] font-mono text-text-tertiary/70">
        {metric.confidence}
      </div>
    </motion.div>
  );
}

export function EvaluationSection() {
  return (
    <section
      id="evaluation"
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full bg-rose-500/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="text-center mb-16">
          <SectionHeader
            number="08 — Evaluation"
            icon={<BarChart3 size={12} className="text-rose-400" />}
            title="Statistical rigor."
            highlight="Not guesswork."
            highlightClassName="text-rose-400"
            description="Every metric includes confidence intervals, p-values, and effect sizes. Know if improvements are real or just noise."
            align="center"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, i) => (
            <AnimatedMetric key={metric.label} metric={metric} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-10 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/40 bg-surface/40 text-[12px] text-text-tertiary">
            <Shield size={14} className="text-green-400" />
            All metrics evaluated on 1,247 labeled queries with bootstrapped confidence intervals
          </div>
        </motion.div>
      </div>
    </section>
  );
}
