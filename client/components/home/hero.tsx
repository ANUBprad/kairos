import React from "react";
import Link from "next/link";
import { ArrowRight, FileText, Quote, ScanSearch, Sparkles } from "lucide-react";

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
  return (
    <section className="kairos-dark-section kairos-aurora relative overflow-hidden pb-32 pt-32 sm:pb-36 sm:pt-40">
      <div className="kairos-grid pointer-events-none absolute inset-x-0 top-0 h-[440px] opacity-30" />

      <div className="kairos-section-wrap relative">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="kairos-kicker text-muted-foreground">Evidence-first research workspace</span>
          </span>

          <h1 className="kairos-editorial-title mt-7 text-[44px] sm:text-[64px] lg:text-[78px]">
            Research that keeps
            <br />
            <span className="text-primary">its receipts.</span>
          </h1>

          <p className="kairos-lede mx-auto mt-6 text-center text-[15px] sm:text-base">
            Kairos reads across your sources, answers with citations you can open,
            then turns the same library into study material and a podcast you can
            interrupt.
          </p>

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

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span>Free-window credits + welcome bonus</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>No recurring subscription</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>Your library, one workspace</span>
          </div>
        </div>

        <div className="relative mt-16 overflow-hidden rounded-[22px] border border-border bg-surface/60 sm:mt-20">
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
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-pipeline"
      />
    </section>
  );
}
