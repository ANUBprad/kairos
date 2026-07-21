"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
} from "framer-motion";
import { Scissors, ArrowRight } from "lucide-react";
import { SectionHeader } from "./section-header";
import { useParallax } from "./use-parallax";

const chunks = [
  {
    id: "chunk_001",
    text: "The study found that hybrid retrieval combining dense embeddings with sparse BM25 vectors consistently outperformed pure vector search across all evaluated benchmarks.",
    overlap: "retrieval strategies",
  },
  {
    id: "chunk_002",
    text: "Performance gains were most pronounced on technical documentation where exact keyword matching complements semantic understanding. Recall@10 improved by 12.4%.",
    overlap: "semantic understanding",
  },
  {
    id: "chunk_003",
    text: "The cross-encoder reranking stage further refined results, achieving a 7.2% improvement in nDCG@10 over the baseline retrieval configuration.",
    overlap: "improvement in nDCG",
  },
];

export function ChunkingSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const { ref: parallaxRef, y: parallaxY } = useParallax({ output: [60, 0] });

  return (
    <section
      id="chunking"
      ref={sectionRef}
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-teal-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <SectionHeader
              number="03 — Chunking"
              icon={<Scissors size={12} className="text-teal-400" />}
              title="Intelligent text"
              highlight="segmentation."
              highlightClassName="text-teal-400"
              description="Text is divided into meaningful chunks. Overlap ensures no context is lost between boundaries. Every chunk gets a unique ID for traceability through the entire pipeline."
            />

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="space-y-3 pt-4"
            >
              {[
                { label: "5 Chunking Strategies", desc: "Recursive, sentence, fixed-size, Markdown, semantic" },
                { label: "Configurable Overlap", desc: "Fine-tune context preservation between chunks" },
                { label: "Visual Preview", desc: "See exactly how your documents will be split" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{item.label}</div>
                    <div className="text-xs text-text-tertiary">{item.desc}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.div
            ref={parallaxRef}
            style={{ y: parallaxY }}
            className="relative flex items-center justify-center min-h-[420px]"
          >
            <div className="w-full max-w-md space-y-4">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-2 mb-6"
              >
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-[11px] text-text-tertiary font-medium">Source Document</span>
                <div className="h-px flex-1 bg-border/40" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex items-center justify-center mb-4"
              >
                <motion.div
                  animate={isInView ? { x: [0, 40, 0] } : {}}
                  transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20"
                >
                  <Scissors size={14} className="text-teal-400" />
                  <span className="text-[11px] font-medium text-teal-400">Splitting...</span>
                </motion.div>
              </motion.div>

              {chunks.map((chunk, i) => (
                <motion.div
                  key={chunk.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: 0.6 + i * 0.2,
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative rounded-xl border border-border/50 bg-surface/60 p-4 shadow-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                      {chunk.id}
                    </span>
                    {i < chunks.length - 1 && (
                      <span className="text-[9px] text-text-tertiary bg-surface/80 px-2 py-0.5 rounded border border-border/30">
                        overlap: &ldquo;{chunk.overlap}&rdquo;
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {chunk.text}
                  </p>

                  {i < chunks.length - 1 && (
                    <div className="absolute -bottom-2 left-4 right-4 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
                  )}
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.3, duration: 0.4 }}
                className="flex items-center justify-center gap-2 pt-2"
              >
                <ArrowRight size={12} className="text-text-tertiary" />
                <span className="text-[11px] text-text-tertiary">
                  247 chunks created from 42 pages
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
