"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTASection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const bgOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);

  return (
    <section
      id="cta"
      ref={sectionRef}
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(255,90,10,0.08),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent" />
      </motion.div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-[44px] sm:text-[56px] md:text-[64px] font-bold tracking-tight leading-[1] text-text-primary"
        >
          Your Research.
          <br />
          Your Knowledge.
          <br />
          <span className="bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent">
            Your Models.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-[17px] text-text-secondary max-w-lg mx-auto leading-relaxed"
        >
          One workbench to build, evaluate, and understand
          your RAG systems — with full transparency.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button variant="primary" size="xl" className="gap-2" asChild>
            <Link href="/app">
              Start Building
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button variant="secondary" size="xl" className="gap-2" asChild>
            <a
              href="https://github.com/kairos-ai/kairos"
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
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-8 text-[13px] text-text-tertiary"
        >
          Open source • MIT License • No vendor lock-in
        </motion.p>
      </div>
    </section>
  );
}
