"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTASection() {
  return (
    <section id="cta" className="border-t border-border bg-bg-secondary">
      <div className="mx-auto w-full max-w-[1120px] px-6 py-24 text-center sm:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-[22ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary sm:text-[44px]"
        >
          Your sources. Your research.{" "}
          <span className="text-brand">Your knowledge.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-5 max-w-[52ch] text-[16px] leading-relaxed text-text-secondary sm:text-[17px]"
        >
          One workspace to bring your sources, understand them, create from them,
          and learn from them.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button variant="primary" size="lg" className="gap-2" asChild>
            <Link href="/app">
              Start researching
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" className="gap-2" asChild>
            <a
              href="https://github.com/ANUBprad/kairos"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={16} />
              GitHub
            </a>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-8 text-[13px] text-text-tertiary"
        >
          Open source • MIT License • No vendor lock-in
        </motion.p>
      </div>
    </section>
  );
}
