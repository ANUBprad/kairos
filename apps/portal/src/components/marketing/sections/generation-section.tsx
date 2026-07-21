"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  motion,
  useInView,
  AnimatePresence,
} from "framer-motion";
import { Bot, Quote, ExternalLink } from "lucide-react";
import { SectionHeader } from "./section-header";

const answerWords = [
  "Hybrid",
  "retrieval",
  "outperforms",
  "pure",
  "vector",
  "search",
  "because",
  "it",
  "combines",
  "the",
  "semantic",
  "understanding",
  "of",
  "dense",
  "embeddings",
  "with",
  "the",
  "keyword",
  "precision",
  "of",
  "BM25.",
  "The",
  "study",
  "found",
  "a",
  "12.4%",
  "improvement",
  "in",
  "Recall@10",
  "(p=0.003).",
];

const citations = [
  {
    id: 1,
    chunkId: "chunk_001",
    text: "Hybrid retrieval combining dense embeddings with sparse BM25 vectors consistently outperformed pure vector search.",
    score: 0.94,
  },
  {
    id: 2,
    chunkId: "chunk_045",
    text: "Recall@10 improved by 12.4% over the baseline retrieval configuration.",
    score: 0.85,
  },
];

const citationPositions: Record<number, number> = {
  0: 1,
  24: 2,
};

export function GenerationSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [wordsVisible, setWordsVisible] = useState(0);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  useEffect(() => {
    if (!isInView) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setWordsVisible(answerWords.length);
      return;
    }
    const timeout = setTimeout(() => {
      let count = 0;
      const interval = setInterval(() => {
        count++;
        setWordsVisible(count);
        if (count >= answerWords.length) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }, 600);
    return () => clearTimeout(timeout);
  }, [isInView]);

  const handleCitationFocus = useCallback((citId: number) => {
    setActiveCitation(citId);
  }, []);

  const handleCitationBlur = useCallback(() => {
    setActiveCitation(null);
  }, []);

  const renderAnswer = () => {
    const parts: React.ReactNode[] = [];

    answerWords.forEach((word, i) => {
      if (i <= wordsVisible - 1) {
        if (citationPositions[i]) {
          const citId = citationPositions[i];
          const cit = citations.find((c) => c.id === citId);
          parts.push(
            <span
              key={`cit-${citId}`}
              className="relative inline-flex"
            >
              <button
                type="button"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand/20 text-brand text-[8px] font-bold cursor-help mx-0.5 align-super focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onMouseEnter={() => setActiveCitation(citId)}
                onMouseLeave={() => setActiveCitation(null)}
                onFocus={() => handleCitationFocus(citId)}
                onBlur={handleCitationBlur}
                aria-label={`Citation ${citId}: ${cit?.text}`}
              >
                {citId}
              </button>
              <AnimatePresence>
                {activeCitation === citId && cit && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 max-w-[calc(100vw-3rem)] z-50"
                    role="tooltip"
                  >
                    <div className="rounded-xl border border-border/50 bg-surface/95 p-4 shadow-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Quote size={12} className="text-brand" />
                        <span className="text-[10px] font-semibold text-text-tertiary">
                          {cit.chunkId}
                        </span>
                        <span className="text-[10px] font-mono text-green-400 ml-auto">
                          sim: {cit.score}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {cit.text}
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-[9px] text-brand">
                        <ExternalLink size={9} />
                        <span>View in pipeline trace</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </span>
          );
        }
        parts.push(
          <motion.span
            key={`word-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="inline"
          >
            {word}{" "}
          </motion.span>
        );
      }
    });

    return parts;
  };

  return (
    <section
      id="generation"
      ref={sectionRef}
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <SectionHeader
              number="07 — Generation"
              icon={<Bot size={12} className="text-emerald-400" />}
              title="Every word,"
              highlight="traceable."
              highlightClassName="text-emerald-400"
              description="The LLM synthesizes an answer from the retrieved chunks. Every sentence is grounded in a specific source. Hover any citation to see the original chunk, its similarity score, and how it was selected."
            />

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="space-y-2 pt-4"
            >
              {citations.map((cit) => (
                <div
                  key={cit.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-surface/40"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand/20 text-brand text-[10px] font-bold shrink-0 mt-0.5">
                    {cit.id}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-text-tertiary">
                        {cit.chunkId}
                      </span>
                      <span className="text-[10px] font-mono text-green-400">
                        sim: {cit.score}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {cit.text}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="relative flex items-center justify-center min-h-[420px]">
            <div className="w-full max-w-lg">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="rounded-2xl border border-border/50 bg-surface/60 overflow-hidden shadow-xl"
              >
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40">
                  <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
                  <span className="text-[11px] text-text-tertiary font-mono">
                    RAG Response
                  </span>
                </div>

                <div className="p-6">
                  <p className="text-[15px] leading-relaxed text-text-primary">
                    {renderAnswer()}
                    {wordsVisible < answerWords.length && wordsVisible > 0 && (
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="inline-block w-[2px] h-[1em] bg-brand ml-0.5 align-middle"
                      />
                    )}
                  </p>
                </div>

                <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[10px] text-text-tertiary">
                    Sources: 2 citations verified
                  </span>
                  <span className="text-[10px] text-text-tertiary font-mono">
                    Latency: 1.2s
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
