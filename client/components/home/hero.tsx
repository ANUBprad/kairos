"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Quote, ScanSearch, Sparkles } from "lucide-react";
import { ScrollReveal } from "./scroll-motion";

interface HeroProps {
  isAuthenticated?: boolean;
}

const LOOP_STEPS = [
  {
    icon: FileText,
    number: "01",
    label: "Capture",
    detail: "PDFs, pages, transcripts, notes",
  },
  {
    icon: ScanSearch,
    number: "02",
    label: "Retrieve",
    detail: "Passages matched to the question",
  },
  {
    icon: Quote,
    number: "03",
    label: "Answer",
    detail: "Every claim linked to its source",
  },
];

export function Hero({ isAuthenticated = false }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const atmosphereRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const ledeRef = useRef<HTMLParagraphElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const reset = () => {
      const layers: (HTMLElement | null)[] = [
        atmosphereRef.current,
        headlineRef.current,
        ledeRef.current,
        visualRef.current,
      ];

      layers.forEach((element) => {
        if (!element) return;
        element.style.transform = "";
        element.style.opacity = "";
      });
    };

    const update = () => {
      frame = 0;
      if (media.matches) {
        reset();
        return;
      }

      const rect = section.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(0, -rect.top / Math.max(rect.height, 1)),
      );

      if (atmosphereRef.current) {
        atmosphereRef.current.style.transform = `translate3d(0, ${(progress * 30).toFixed(1)}px, 0)`;
      }
      if (headlineRef.current) {
        headlineRef.current.style.transform = `translate3d(0, ${(-progress * 18).toFixed(1)}px, 0)`;
      }
      if (ledeRef.current) {
        ledeRef.current.style.transform = `translate3d(0, ${(-progress * 10).toFixed(1)}px, 0)`;
        ledeRef.current.style.opacity = (1 - progress * 0.12).toFixed(3);
      }
      if (visualRef.current) {
        visualRef.current.style.transform = `translate3d(0, ${(progress * 22).toFixed(1)}px, 0)`;
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    media.addEventListener("change", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", schedule);
      reset();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="kairos-dark-section kairos-aurora relative overflow-hidden pb-32 pt-32 sm:pb-36 sm:pt-40"
    >
      <div
        ref={atmosphereRef}
        className="kairos-grid pointer-events-none absolute inset-x-0 top-0 h-[440px] opacity-30"
      />

      <div className="kairos-section-wrap relative">
        <div className="mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5">
              <Sparkles className="size-3.5 text-primary" />
              <span className="kairos-kicker text-muted-foreground">Evidence-first research workspace</span>
            </span>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <h1
              ref={headlineRef}
              className="kairos-editorial-title mt-7 text-[44px] sm:text-[64px] lg:text-[78px]"
            >
              Research that keeps
              <br />
              <span className="text-primary">its receipts.</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={140}>
            <p
              ref={ledeRef}
              className="kairos-lede mx-auto mt-6 text-center text-[15px] sm:text-base"
            >
              Kairos reads across your sources, answers with citations you can open,
              then turns the same library into study material and a podcast you can
              interrupt.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className="kairos-button kairos-button-light"
              >
                {isAuthenticated ? "Open dashboard" : "Start researching"}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/#workflow"
                className="kairos-button border border-border bg-surface/60 text-foreground hover:bg-surface-hover"
              >
                See the pipeline
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={260}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span>Free-window credits + welcome bonus</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-border" />
              <span>No recurring subscription</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-border" />
              <span>Your library, one workspace</span>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={180}>
          <div
            ref={visualRef}
            className="relative mt-16 overflow-hidden rounded-[22px] border border-border bg-surface/60 sm:mt-20"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
              <div className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_2px_color-mix(in_srgb,var(--primary)_45%,transparent)]" />
                <span className="text-sm font-semibold text-foreground">The evidence loop</span>
              </div>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                capture → retrieve → cite
              </span>
            </div>

            <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {LOOP_STEPS.map((step) => (
                <div key={step.label} className="p-6 sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface/60 text-primary">
                      <step.icon className="size-5" strokeWidth={1.5} />
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground/70">
                      {step.number}
                    </span>
                  </div>
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {step.label}
                  </p>
                  <p className="mt-2 text-sm text-foreground/85">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-pipeline"
      />
    </section>
  );
}
