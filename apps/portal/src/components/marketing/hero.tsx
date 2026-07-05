"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, FileText, Layers, GitBranch } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const fadeIn = {
  hidden: { opacity: 0, x: 30 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const capabilities = [
  {
    icon: Search,
    label: "Semantic Search",
    value: "dense + sparse",
    color: "text-info",
    delay: 0.3,
  },
  {
    icon: FileText,
    label: "Documents",
    value: "PDF, DOCX, MD",
    color: "text-success",
    delay: 0.6,
  },
  {
    icon: Layers,
    label: "Embeddings",
    value: "1536-dim",
    color: "text-warning",
    delay: 0.9,
  },
  {
    icon: GitBranch,
    label: "Strategies",
    value: "hybrid + MMR",
    color: "text-brand",
    delay: 1.2,
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 md:pb-32 min-h-[90vh] flex items-center">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255, 90, 10, 0.3) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div className="absolute bottom-1/4 -right-40 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-[560px]">
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand/30 bg-brand/5 text-[11px] font-semibold text-brand tracking-wide uppercase mb-6">
                Open-Source RAG Research Platform
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-[40px] sm:text-[48px] md:text-[56px] font-semibold tracking-tight leading-[1.08] text-balance"
            >
              A research platform for retrieval-augmented generation.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-[18px] text-text-secondary leading-relaxed max-w-[480px]"
            >
               An open-source platform for studying RAG pipelines — document chunking, embeddings, retrieval strategies, and evaluation metrics — with full observability into every stage.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col sm:flex-row items-start gap-4"
            >
              <Button variant="primary" size="lg" className="gap-2" asChild>
                <Link href="/signup">
                  Get started
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="#features">Explore research</Link>
              </Button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-6 flex items-center gap-4 text-xs text-text-tertiary"
            >
              <span>PDF, DOCX, CSV, MD</span>
              <span className="w-1 h-1 rounded-full bg-text-tertiary/40" />
              <span>pgvector embeddings</span>
              <span className="w-1 h-1 rounded-full bg-text-tertiary/40" />
              <span>OpenAI + Gemini</span>
            </motion.div>
          </div>

          <motion.div variants={fadeIn} className="relative">
            <div className="relative rounded-xl border border-border bg-surface/80 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
                <div className="w-2.5 h-2.5 rounded-full bg-error/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
                <span className="ml-2 text-[11px] text-text-tertiary font-medium">RAG Query</span>
              </div>
              <div className="space-y-2 font-mono text-sm leading-relaxed">
                <div className="text-text-secondary">
                  <span className="text-text-tertiary">$ </span>
                  <span className="text-success">POST</span> /api/ai/chat
                </div>
                <div>
                  <span className="text-text-tertiary">{`{`}</span>
                </div>
                <div className="pl-4">
                  <span className="text-text-tertiary">&quot;query&quot;: </span>
                  <span className="text-warning">&quot;What are the key findings?&quot;</span>
                </div>
                <div className="pl-4">
                  <span className="text-text-tertiary">&quot;kbId&quot;: </span>
                  <span className="text-warning">&quot;kb_123&quot;</span>
                </div>
                <div>
                  <span className="text-text-tertiary">{`}`}</span>
                </div>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-text-tertiary">{`>`}</span>
                  <span className="text-info"> Searching </span>
                  <span className="text-text-tertiary">1536-dim embeddings...</span>
                </motion.div>
                <div className="text-text-tertiary">
                  # Retrieved 5 chunks (similarity: 0.89)
                </div>
              </div>
            </div>

            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <motion.div
                  key={cap.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: cap.delay, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg/90 backdrop-blur-sm shadow-md"
                  style={{
                    top: `${-10 + (capabilities.indexOf(cap) * 22)}%`,
                    right: `${-20 + (capabilities.indexOf(cap) * 5)}%`,
                  }}
                >
                  <Icon size={14} className={cap.color} />
                  <span className="text-[11px] font-medium text-text-secondary">{cap.label}</span>
                  <span className={`text-[11px] font-bold ${cap.color}`}>{cap.value}</span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
