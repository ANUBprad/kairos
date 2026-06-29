"use client";

import { motion } from "framer-motion";
import { Check, ArrowDown } from "lucide-react";
import { SectionWrapper, SectionHeading } from "./section-wrapper";
import { ScrollReveal, StaggerContainer, staggerItem } from "@/components/shared/scroll-reveal";

const bullets = [
  "Go API Gateway with auth, rate limiting, and Redis caching",
  "Python Intelligence Engine with adaptive retrieval and confidence calibration",
  "PostgreSQL for billing and user data, Redis for caching and sessions",
  "ChromaDB for vector storage — or bring your own vector store",
  "Prometheus + Grafana for full observability out of the box",
  "OpenTelemetry for distributed tracing across all services",
];

export function ArchitectureSection() {
  return (
    <SectionWrapper id="architecture">
      <ScrollReveal>
        <SectionHeading>Production Architecture</SectionHeading>
      </ScrollReveal>

      <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <ScrollReveal direction="left">
          <StaggerContainer staggerDelay={0.08}>
            {bullets.map((b, i) => (
              <motion.div
                key={i}
                variants={staggerItem()}
                className="flex items-start gap-3 mb-4 last:mb-0"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success/15 mt-0.5 shrink-0">
                  <Check size={11} className="text-success" />
                </span>
                <span className="text-sm text-text-secondary leading-relaxed">{b}</span>
              </motion.div>
            ))}
          </StaggerContainer>
        </ScrollReveal>

        <ScrollReveal direction="right">
          <div className="rounded-xl border border-border bg-surface/50 p-8">
            <div className="flex flex-col items-center gap-2 text-xs">
              <div className="px-5 py-2.5 rounded-[10px] border border-border bg-bg text-text-primary font-medium shadow-sm">
                Client SDK / Browser
              </div>
              <ArrowDown size={14} className="text-text-tertiary/50" />
              <motion.div
                animate={{ boxShadow: ["0 0 0px rgba(255,90,10,0)", "0 0 20px rgba(255,90,10,0.15)", "0 0 0px rgba(255,90,10,0)"] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="px-5 py-2.5 rounded-[10px] border border-brand/30 bg-brand/[0.04] text-brand font-medium"
              >
                Go API Gateway
              </motion.div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-tertiary/60">Redis Cache</span>
              </div>
              <ArrowDown size={14} className="text-text-tertiary/50" />
              <div className="px-4 py-1.5 rounded-[8px] border border-border bg-bg text-text-tertiary text-[10px] font-mono">
                gRPC
              </div>
              <ArrowDown size={14} className="text-text-tertiary/50" />
              <motion.div
                animate={{ boxShadow: ["0 0 0px rgba(59,130,246,0)", "0 0 20px rgba(59,130,246,0.12)", "0 0 0px rgba(59,130,246,0)"] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                className="px-5 py-2.5 rounded-[10px] border border-info/30 bg-info/[0.04] text-info font-medium"
              >
                Python Intelligence Engine
              </motion.div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-text-tertiary/60 px-2 py-1 rounded-[6px] border border-border bg-bg">Classifier</span>
                <span className="text-[10px] text-text-tertiary/60 px-2 py-1 rounded-[6px] border border-border bg-bg">Planner</span>
                <span className="text-[10px] text-text-tertiary/60 px-2 py-1 rounded-[6px] border border-border bg-bg">Optimizer</span>
              </div>
              <ArrowDown size={14} className="text-text-tertiary/50" />
              <div className="flex items-center gap-3 mt-1">
                <div className="px-3 py-1.5 rounded-[8px] border border-border bg-bg text-text-tertiary text-[10px]">
                  Vector Store
                </div>
                <div className="px-3 py-1.5 rounded-[8px] border border-border bg-bg text-text-tertiary text-[10px]">
                  LLM Provider
                </div>
              </div>
              <ArrowDown size={14} className="text-text-tertiary/50" />
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-[8px] border border-success/20 bg-success/[0.03] text-success/80 text-[10px]">
                  PostgreSQL
                </div>
                <div className="px-3 py-1.5 rounded-[8px] border border-success/20 bg-success/[0.03] text-success/80 text-[10px]">
                  Prometheus
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </SectionWrapper>
  );
}
