"use client";

import { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
} from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText } from "lucide-react";

function FloatingDocument() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: "100px" });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 8]);

  return (
    <motion.div
      ref={ref}
      style={{ y, opacity, rotate }}
      className="absolute right-[10%] top-[20%] pointer-events-none hidden lg:block"
      aria-hidden="true"
    >
      <div className="relative w-48 h-64">
        <motion.div
          animate={isInView ? { y: [0, -6, 0], rotate: [0, 1, 0] } : {}}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-xl border border-border/30 bg-surface/40 shadow-xl"
        >
          <div className="p-4 space-y-3">
            <div className="h-2 w-16 rounded-full bg-brand/30" />
            <div className="space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-text-tertiary/15" />
              <div className="h-1.5 w-4/5 rounded-full bg-text-tertiary/15" />
              <div className="h-1.5 w-full rounded-full bg-text-tertiary/15" />
              <div className="h-1.5 w-3/5 rounded-full bg-text-tertiary/15" />
            </div>
            <div className="space-y-1.5 pt-2">
              <div className="h-1.5 w-full rounded-full bg-text-tertiary/10" />
              <div className="h-1.5 w-2/3 rounded-full bg-text-tertiary/10" />
            </div>
            <div className="pt-2 flex gap-2">
              <div className="h-1.5 w-12 rounded-full bg-info/20" />
              <div className="h-1.5 w-8 rounded-full bg-success/20" />
            </div>
          </div>
        </motion.div>
        <motion.div
          animate={isInView ? { y: [0, -3, 0] } : {}}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute inset-0 rounded-xl border border-border/15 bg-surface/20 -z-10 translate-x-2 translate-y-2"
        />
      </div>
    </motion.div>
  );
}

function AnimatedHeadline() {
  const ref = useRef<HTMLHeadingElement>(null);
  const isInView = useInView(ref, { once: true });
  const words = ["Build.", "Understand.", "Trust."];

  return (
    <h1
      ref={ref}
      className="text-[36px] sm:text-[68px] md:text-[80px] lg:text-[96px] font-bold tracking-tight leading-[0.92]"
    >
      {words.map((word, i) => (
        <span key={word} className="block">
          <motion.span
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={
              isInView
                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                : {}
            }
            transition={{
              delay: 0.3 + i * 0.2,
              duration: 0.7,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="inline-block"
          >
            {i === 2 ? (
              <span className="bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent">
                {word}
              </span>
            ) : (
              <span className="text-text-primary">{word}</span>
            )}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

function TypewriterText() {
  const ref = useRef<HTMLParagraphElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const text = "Every AI answer has a story.";
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!isInView) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setDisplayed(text);
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <p ref={ref} className="text-[17px] sm:text-[19px] text-text-secondary leading-relaxed max-w-[480px]">
      {displayed}
      {displayed.length < text.length && displayed.length > 0 && (
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-[2px] h-[1.1em] bg-brand ml-0.5 align-middle"
        />
      )}
    </p>
  );
}

function ScrollIndicator() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);
  const scrollYRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(scrollYRef, { once: false, margin: "200px" });

  return (
    <motion.div
      ref={(node) => {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        (scrollYRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={{ opacity }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      aria-hidden="true"
    >
      <span className="text-[11px] text-text-tertiary tracking-widest uppercase">
        Scroll to explore
      </span>
      <motion.div
        animate={isInView ? { y: [0, 6, 0] } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="w-5 h-8 rounded-full border-2 border-text-tertiary/30 flex items-start justify-center pt-1.5"
      >
        <div className="w-1 h-1.5 rounded-full bg-brand" />
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none dark:bg-[image:radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)]"
        style={{ backgroundSize: "32px 32px" }}
        aria-hidden="true"
      />

      <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(255,90,10,0.2)_0%,transparent_70%)] blur-[80px] animate-pulse opacity-15" aria-hidden="true" />

      <FloatingDocument />

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8 pt-32 pb-24">
        <div className="max-w-[640px] space-y-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-surface/60 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
              <FileText size={12} className="text-brand" />
              Explainable RAG Research Platform
            </span>
          </motion.div>

          <AnimatedHeadline />

          <TypewriterText />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-start gap-3 pt-2"
          >
            <Button variant="primary" size="lg" className="gap-2" asChild>
              <Link href="/app">
                Start Building
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <a
                href="https://github.com/kairos-ai/kairos"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
            </Button>
          </motion.div>
        </div>
      </div>

      <ScrollIndicator />
    </section>
  );
}
