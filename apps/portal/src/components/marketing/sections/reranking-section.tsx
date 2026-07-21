"use client";

import { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
} from "framer-motion";
import { ListOrdered, Award, ArrowUp } from "lucide-react";
import { SectionHeader } from "./section-header";

const rerankedChunks = [
  { id: "chunk_001", initialRank: 1, finalRank: 1, score: 0.94, delta: 0, text: "Hybrid retrieval combining dense embeddings with sparse BM25" },
  { id: "chunk_012", initialRank: 3, finalRank: 2, score: 0.91, delta: 1, text: "Performance gains on technical documentation with keyword matching" },
  { id: "chunk_023", initialRank: 2, finalRank: 3, score: 0.88, delta: -1, text: "Cross-encoder reranking further refined results significantly" },
  { id: "chunk_045", initialRank: 4, finalRank: 4, score: 0.85, delta: 0, text: "Recall@10 improved by 12.4% over pure vector search baseline" },
];

export function RerankingSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [reranked, setReranked] = useState(false);

  useEffect(() => {
    if (isInView) {
      const timeout = setTimeout(() => setReranked(true), 1000);
      return () => clearTimeout(timeout);
    }
  }, [isInView]);

  return (
    <section
      id="reranking"
      ref={sectionRef}
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <SectionHeader
              number="06 — Reranking"
              icon={<ListOrdered size={12} className="text-amber-400" />}
              title="Precision meets"
              highlight="confidence."
              highlightClassName="text-amber-400"
              description="Retrieved chunks are re-evaluated by a cross-encoder model. It reads each chunk against the original query and assigns a refined confidence score. The most relevant results rise to the top."
            />

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="rounded-xl border border-border/50 bg-surface/60 p-5 shadow-lg space-y-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Award size={16} className="text-amber-400" />
                <span className="text-sm font-semibold text-text-primary">
                  Cross-Encoder Reranker
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-text-tertiary uppercase tracking-wider mb-1">
                    Before Reranking
                  </div>
                  <div className="text-lg font-bold text-text-primary font-mono">
                    Recall@4: <span className="text-text-secondary">0.75</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-text-tertiary uppercase tracking-wider mb-1">
                    After Reranking
                  </div>
                  <div className="text-lg font-bold text-green-400 font-mono">
                    Recall@4: <span className="text-green-400">0.92</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="relative flex items-center justify-center min-h-[420px]">
            <div className="w-full max-w-md space-y-3">
              {rerankedChunks.map((chunk, i) => {
                const moveUp = chunk.delta > 0;
                const moveDown = chunk.delta < 0;
                return (
                  <motion.div
                    key={chunk.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }}
                    className="relative"
                  >
                    <motion.div
                      animate={
                        reranked
                          ? {
                              y: moveUp ? -8 : moveDown ? 8 : 0,
                              borderColor: reranked
                                ? "rgba(245,158,11,0.3)"
                                : "rgba(42,42,42,0.4)",
                            }
                          : {}
                      }
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-surface/60"
                    >
                      <div className="shrink-0 w-8 text-center">
                        <motion.div
                          animate={reranked ? { scale: [1, 1.15, 1] } : {}}
                          transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                          className="text-lg font-bold font-mono text-amber-400"
                        >
                          #{chunk.finalRank}
                        </motion.div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-secondary truncate">
                          {chunk.text}
                        </p>
                      </div>

                      <div className="shrink-0 text-right space-y-0.5">
                        <div className="text-[11px] font-mono font-bold text-amber-400">
                          {chunk.score.toFixed(2)}
                        </div>
                        {chunk.delta !== 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={reranked ? { opacity: 1, y: 0 } : {}}
                            transition={{ delay: 0.8 + i * 0.1 }}
                            className={`flex items-center gap-0.5 justify-end text-[9px] font-semibold ${
                              moveUp ? "text-green-400" : "text-error"
                            }`}
                          >
                            {moveUp ? (
                              <ArrowUp size={10} />
                            ) : (
                              <ArrowUp size={10} className="rotate-180" />
                            )}
                            {Math.abs(chunk.delta)}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.2, duration: 0.4 }}
                className="flex items-center justify-center gap-2 pt-4"
              >
                <div className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-400">
                  Cross-encoder applied • ms-marco-MiniLM-L-6-v2
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
