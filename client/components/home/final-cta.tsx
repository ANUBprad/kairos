import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

interface FinalCtaProps {
  isAuthenticated?: boolean;
}

export function FinalCta({ isAuthenticated = false }: FinalCtaProps) {
  const href = isAuthenticated ? "/dashboard" : "/signup";
  const label = isAuthenticated ? "Open dashboard" : "Start researching";

  return (
    <section
      id="get-started"
      className="kairos-dark-section relative scroll-mt-24 overflow-hidden py-28 sm:py-32"
      aria-labelledby="final-cta-heading"
    >
      <div className="kairos-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-20" />
      <div
        aria-hidden="true"
        className="kairos-final-glow pointer-events-none absolute inset-0"
      />

      <div className="kairos-section-wrap relative text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <span className="kairos-kicker text-muted-foreground">Begin with a question</span>
        </span>

        <h2
          id="final-cta-heading"
          className="kairos-editorial-title mx-auto mt-7 max-w-4xl text-[40px] sm:text-[58px] lg:text-[70px]"
        >
          Bring your sources.
          <br />
          <span className="text-primary">Keep the receipts.</span>
        </h2>

        <p className="kairos-lede mx-auto mt-6 text-center text-[15px] sm:text-base">
          Add what you already trust, ask what you actually need, and follow every
          answer back to the evidence that made it.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href={href} className="kairos-button kairos-button-light">
            {label}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href={isAuthenticated ? "/#sources" : "/#workflow"}
            className="kairos-button border border-border bg-surface/60 text-foreground hover:bg-surface-hover"
          >
            {isAuthenticated ? "View sources" : "See the pipeline"}
          </Link>
        </div>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          One-time plans · free credits each window · no recurring subscription
        </p>
      </div>
    </section>
  );
}
