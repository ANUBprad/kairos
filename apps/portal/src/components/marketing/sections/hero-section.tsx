"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Hero() {
  return (
    <section id="hero" className="border-b border-border">
      <div className="mx-auto w-full max-w-[1120px] px-6 pt-32 pb-20 sm:px-8 sm:pt-36 sm:pb-24">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary"
        >
          <FileText size={12} className="text-brand" />
          Your research workspace
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-8 max-w-[16ch] text-[40px] font-semibold leading-[1.04] tracking-[-0.02em] text-text-primary sm:text-[56px] md:text-[68px]"
        >
          Bring your sources.
          <br />
          Understand them.
          <br />
          Create from them.
          <br />
          <span className="text-brand">Learn them.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
          className="mt-7 max-w-[58ch] text-[17px] leading-[1.7] text-text-secondary sm:text-[18px]"
        >
          Kairos is one research workspace: upload your sources, ask grounded
          questions with citations, turn them into summaries, quizzes, and
          flashcards, and study to actually keep the knowledge.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
          className="mt-9 flex flex-col items-start gap-3 sm:flex-row"
        >
          <Button variant="primary" size="lg" className="gap-2" asChild>
            <Link href="/app">
              Open your workspace
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <a
              href="https://github.com/ANUBprad/kairos"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
