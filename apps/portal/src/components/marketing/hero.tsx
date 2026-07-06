"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileText,
  Scissors,
  TableProperties,
  Search,
  ListOrdered,
  Bot,
  BarChart3,
  Database,
} from "lucide-react";

const STAGES = [
  { id: "docs", label: "Documents", icon: FileText, color: "bg-blue-500" },
  { id: "chunk", label: "Chunking", icon: Scissors, color: "bg-cyan-500" },
  { id: "embed", label: "Embeddings", icon: TableProperties, color: "bg-teal-500" },
  { id: "store", label: "Vector Store", icon: Database, color: "bg-emerald-500" },
  { id: "retrieve", label: "Retrieval", icon: Search, color: "bg-green-500" },
  { id: "rerank", label: "Reranking", icon: ListOrdered, color: "bg-yellow-500" },
  { id: "llm", label: "LLM", icon: Bot, color: "bg-purple-500" },
  { id: "eval", label: "Evaluation", icon: BarChart3, color: "bg-violet-500" },
];

const STATS = [
  { icon: FileText, label: "Multi-format Documents", value: "PDF, DOCX, MD" },
  { icon: Scissors, label: "Chunking Strategies", value: "5" },
  { icon: TableProperties, label: "Embedding Models", value: "3+" },
  { icon: Search, label: "Retrieval Strategies", value: "8" },
  { icon: BarChart3, label: "Evaluation Metrics", value: "12" },
  { icon: Database, label: "Benchmark Reports", value: "Export" },
];

const CODE_LINES = [
  { type: "request", text: 'POST /api/chat' },
  { type: "question", text: 'Question: "What are the key findings?"' },
  { type: "step", text: 'Searching...' },
  { type: "result", text: 'Retrieved: 5 relevant chunks' },
  { type: "step", text: 'Building prompt...' },
  { type: "result", text: 'Generating response...' },
  { type: "answer", text: 'The study found that hybrid retrieval' },
  { type: "answer2", text: 'outperforms pure vector search by 12%.' },
];

function AnimatedKairos() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <span className="text-transparent">Kairos</span>;

  const letters = "KAIROS".split("");

  return (
    <span className="inline-flex">
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08, duration: 0.4, ease: "easeOut" }}
          className="inline-block"
        >
          {letter}
        </motion.span>
      ))}
    </span>
  );
}

function CodePanel() {
  const [mounted, setMounted] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= CODE_LINES.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 600);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative rounded-2xl border border-border/50 bg-surface/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/20">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <div className="w-2.5 h-2.5 rounded-full bg-error/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
        <span className="ml-2 text-[11px] text-text-tertiary font-mono">RAG Query</span>
      </div>
      <div className="p-4 font-mono text-[13px] leading-relaxed min-h-[220px]">
        <AnimatePresence>
          {CODE_LINES.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-1.5"
            >
              {line.type === "request" && (
                <span>
                  <span className="text-success font-semibold">{line.text.split(" ")[0]}</span>
                  <span className="text-text-secondary"> {line.text.split(" ").slice(1).join(" ")}</span>
                </span>
              )}
              {line.type === "question" && (
                <span className="text-warning">{line.text}</span>
              )}
              {line.type === "step" && (
                <span>
                  <span className="text-text-tertiary">{">"} </span>
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-info"
                  >
                    {line.text}
                  </motion.span>
                </span>
              )}
              {line.type === "result" && (
                <span className="text-text-tertiary"># {line.text}</span>
              )}
              {line.type === "answer" && (
                <span className="text-success">{line.text}</span>
              )}
              {line.type === "answer2" && (
                <span className="text-success">{line.text}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {visibleLines < CODE_LINES.length && (
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="inline-block w-2 h-4 bg-text-tertiary/50 ml-1"
          />
        )}
      </div>
    </div>
  );
}

function PipelineVisualization() {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-0">
      {STAGES.map((stage, i) => {
        const Icon = stage.icon;
        const isHovered = hoveredStage === stage.id;
        return (
          <div key={stage.id} className="flex flex-col">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 + i * 0.1, duration: 0.4 }}
              className="relative"
              onMouseEnter={() => setHoveredStage(stage.id)}
              onMouseLeave={() => setHoveredStage(null)}
            >
              <motion.div
                whileHover={{ scale: 1.03, x: 2 }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 cursor-default ${
                  isHovered
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "bg-surface/50 hover:bg-surface"
                }`}
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 ${stage.color}`}>
                  <Icon size={14} />
                </div>
                <span className="text-xs font-medium text-text-primary whitespace-nowrap">
                  {stage.label}
                </span>
                {isHovered && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-text-tertiary ml-1"
                  >
                    {i === 0 && "PDF, DOCX, MD"}
                    {i === 1 && "5 strategies"}
                    {i === 2 && "OpenAI, Gemini"}
                    {i === 3 && "pgvector"}
                    {i === 4 && "Hybrid + BM25"}
                    {i === 5 && "Cross-encoder"}
                    {i === 6 && "GPT-4o, Gemini"}
                    {i === 7 && "Recall, nDCG, MRR"}
                  </motion.span>
                )}
              </motion.div>
            </motion.div>
            {i < STAGES.length - 1 && (
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 1.3 + i * 0.1, duration: 0.3 }}
                className="w-px h-2.5 bg-gradient-to-b from-border/60 to-border/20 origin-top ml-[17px]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 md:pb-32 min-h-[90vh] flex items-center">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Ambient glows */}
      <div className="absolute top-1/3 -left-40 w-[600px] h-[600px] rounded-full opacity-15 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255, 90, 10, 0.25) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />
      <div className="absolute bottom-1/3 -right-40 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left column: Hero text */}
          <div className="max-w-[560px] space-y-6">
            {/* Introducing label */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <span className="text-[13px] font-medium text-text-tertiary tracking-widest uppercase">
                Introducing
              </span>
            </motion.div>

            {/* KAIROS heading */}
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-[56px] sm:text-[64px] md:text-[72px] font-bold tracking-tight leading-[0.95]"
            >
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                <AnimatedKairos />
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5, ease: "easeOut" }}
            >
              <p className="text-[15px] sm:text-[17px] text-text-secondary leading-relaxed max-w-[440px]">
                Upload documents. Experiment with retrieval strategies.
                Evaluate every stage of the RAG pipeline through explainable
                visualizations and reproducible benchmarks.
              </p>
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-start gap-3 pt-2"
            >
              <Button variant="primary" size="lg" className="gap-2" asChild>
                <Link href="/signup">
                  Launch Platform
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/app/architecture">Explore Architecture</Link>
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4"
            >
              {STATS.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.4 + i * 0.06, duration: 0.4 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface/40 border border-border/30"
                  >
                    <Icon size={13} className="text-brand shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-text-primary leading-tight truncate">
                        {stat.value}
                      </div>
                      <div className="text-[10px] text-text-tertiary leading-tight truncate">
                        {stat.label}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Right column: Code panel + Pipeline */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Code panel */}
              <div className="flex-1">
                <CodePanel />
              </div>

              {/* Pipeline visualization */}
              <div className="lg:w-[200px] shrink-0">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.0, duration: 0.5 }}
                  className="rounded-2xl border border-border/50 bg-surface/60 backdrop-blur-xl p-4 shadow-xl shadow-black/10"
                >
                  <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3 text-center">
                    Pipeline
                  </div>
                  <div className="flex justify-center">
                    <PipelineVisualization />
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
