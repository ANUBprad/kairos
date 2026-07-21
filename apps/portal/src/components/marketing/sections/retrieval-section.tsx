"use client";

import { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
  AnimatePresence,
} from "framer-motion";
import { Search, Zap, Database } from "lucide-react";
import { SectionHeader } from "./section-header";

const allChunks = [
  { id: "chunk_001", score: 0.94, relevant: true, text: "Hybrid retrieval combining dense embeddings with sparse BM25" },
  { id: "chunk_012", score: 0.89, relevant: true, text: "Performance gains on technical documentation with keyword matching" },
  { id: "chunk_023", score: 0.87, relevant: true, text: "Cross-encoder reranking further refined results significantly" },
  { id: "chunk_045", score: 0.82, relevant: true, text: "Recall@10 improved by 12.4% over pure vector search baseline" },
  { id: "chunk_007", score: 0.45, relevant: false, text: "The document formatting follows standard academic conventions" },
  { id: "chunk_019", score: 0.38, relevant: false, text: "Appendix A contains additional statistical tables and data" },
  { id: "chunk_031", score: 0.32, relevant: false, text: "References section lists 47 cited papers and studies" },
  { id: "chunk_042", score: 0.28, relevant: false, text: "Acknowledgments thank the review committee for feedback" },
];

export function RetrievalSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [queryActive, setQueryActive] = useState(false);

  useEffect(() => {
    if (isInView) {
      const timeout = setTimeout(() => setQueryActive(true), 800);
      return () => clearTimeout(timeout);
    }
  }, [isInView]);

  return (
    <section
      id="retrieval"
      ref={sectionRef}
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-green-500/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <SectionHeader
              number="05 — Retrieval"
              icon={<Search size={12} className="text-green-400" />}
              title="The right chunks"
              highlight="illuminate."
              highlightClassName="text-green-400"
              description="A user asks a question. Kairos uses hybrid retrieval — combining BM25 keyword matching with dense vector similarity — to find the most relevant chunks. Every match includes a similarity score."
            />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="rounded-xl border border-border/50 bg-surface/60 p-4 shadow-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-green-500/10 flex items-center justify-center">
                  <Search size={12} className="text-green-400" />
                </div>
                <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                  User Query
                </span>
              </div>
              <p className="text-sm font-medium text-text-primary font-mono">
                &ldquo;What caused the improvement in retrieval performance?&rdquo;
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex gap-4 pt-2"
            >
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Database size={14} className="text-blue-400" />
                <span>BM25 Sparse</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Zap size={14} className="text-violet-400" />
                <span>Dense Vector</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-blue-400 to-violet-400" />
                <span>Hybrid RRF</span>
              </div>
            </motion.div>
          </div>

          <div className="relative flex items-center justify-center min-h-[420px]">
            <div className="w-full max-w-md space-y-3">
              <AnimatePresence>
                {allChunks.map((chunk, i) => (
                  <motion.div
                    key={chunk.id}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                    className="relative"
                  >
                    <motion.div
                      animate={
                        queryActive && chunk.relevant
                          ? {
                              borderColor: [
                                "rgba(34,197,94,0.1)",
                                "rgba(34,197,94,0.5)",
                                "rgba(34,197,94,0.3)",
                              ],
                              boxShadow: [
                                "0 0 0 0 rgba(34,197,94,0)",
                                "0 0 20px 0 rgba(34,197,94,0.15)",
                                "0 0 0 0 rgba(34,197,94,0)",
                              ],
                            }
                          : queryActive && !chunk.relevant
                          ? { opacity: 0.3 }
                          : {}
                      }
                      transition={{ duration: 1.5, delay: 0.5 + i * 0.1 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-surface/60"
                    >
                      <div className="shrink-0">
                        <motion.div
                          animate={
                            queryActive && chunk.relevant
                              ? { scale: [1, 1.2, 1] }
                              : {}
                          }
                          transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono ${
                            chunk.relevant
                              ? "bg-green-500/10 text-green-400"
                              : "bg-surface text-text-tertiary"
                          }`}
                        >
                          {chunk.id.split("_")[1]}
                        </motion.div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-secondary truncate">
                          {chunk.text}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <motion.div
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 1 + i * 0.1 }}
                          className={`text-[11px] font-mono font-bold ${
                            chunk.relevant ? "text-green-400" : "text-text-tertiary"
                          }`}
                        >
                          {chunk.score.toFixed(2)}
                        </motion.div>
                      </div>

                      {chunk.relevant && queryActive && (
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 1 + i * 0.15, duration: 0.4 }}
                          className="absolute -left-4 top-1/2 w-4 h-px bg-green-400/40 origin-right"
                          aria-hidden="true"
                        />
                      )}
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
