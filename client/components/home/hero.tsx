import React from "react";
import Link from "next/link";
import { ArrowRight, FileText, Quote, ScanSearch, Sparkles } from "lucide-react";

interface HeroProps {
  isAuthenticated?: boolean;
}

const LOOP_STEPS = [
  {
    icon: FileText,
    label: "Capture",
    detail: "PDFs, pages, transcripts, notes",
  },
  {
    icon: ScanSearch,
    label: "Retrieve",
    detail: "Passages matched to the question",
  },
  {
    icon: Quote,
    label: "Answer",
    detail: "Every claim linked to its source",
  },
];

export function Hero({ isAuthenticated = false }: HeroProps) {
  return (
    <section className="kairos-aurora relative overflow-hidden pb-20 pt-32 sm:pb-24 sm:pt-40">
      <div className="kairos-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-50" />
      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="kairos-eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 backdrop-blur">
            <Sparkles className="size-3.5" />
            Evidence-first research workspace
          </span>

          <h1 className="kairos-display mt-7 text-[42px] sm:text-6xl lg:text-[72px]">
            Research that keeps
            <br />
            <span className="text-brand-accent">its receipts.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Kairos reads across your sources, answers with citations you can open,
            then turns the same library into study material and a podcast you can
            interrupt.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={isAuthenticated ? "/dashboard" : "/signup"}
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-lift)] transition-transform hover:-translate-y-0.5"
            >
              {isAuthenticated ? "Open dashboard" : "Start researching"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/#workflow"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              See how it works
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="kairos-tag">Free-window credits + welcome bonus</span>
            <span className="kairos-tag">No recurring subscription</span>
            <span className="kairos-tag">Your library, one workspace</span>
          </div>
        </div>

        <div className="kairos-panel relative mt-16 overflow-hidden sm:mt-20">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2">
              <span className="kairos-status-dot" />
              <span className="text-sm font-semibold">The evidence loop</span>
            </div>
            <span className="hidden font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:block">
              capture → retrieve → cite
            </span>
          </div>

          <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {LOOP_STEPS.map((step) => (
              <div key={step.label} className="p-6 sm:p-7">
                <div className="kairos-inset inline-flex size-10 items-center justify-center rounded-xl text-primary">
                  <step.icon className="size-5" />
                </div>
                <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {step.label}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
