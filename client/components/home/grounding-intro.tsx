import React from "react";
import Link from "next/link";
import { ArrowRight, FileQuestion, Layers3, Quote } from "lucide-react";
import { ScrollReveal } from "./scroll-motion";

const PRINCIPLES = [
  {
    icon: FileQuestion,
    number: "01",
    label: "The question",
    title: "Where did this claim come from?",
    body: "A fluent answer is not evidence. The passage, page or timestamp stays attached to the statement.",
  },
  {
    icon: Layers3,
    number: "02",
    label: "The retrieval",
    title: "What should the model actually read?",
    body: "Passages are selected for the question, held inside the context budget and presented as one evidence set.",
  },
];

export function GroundingIntro() {
  return (
    <section
      id="grounding"
      className="kairos-dark-section relative overflow-hidden py-24 sm:py-28"
    >
      <div className="kairos-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-20" />

      <div className="kairos-section-wrap relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
        <ScrollReveal>
          <div>
            <p className="kairos-kicker">Grounded by design</p>
            <h2 className="kairos-editorial-title mt-4 text-[34px] sm:text-[46px]">
              Your sources are uploaded.
              <br />
              Your answers still need proof.
            </h2>
            <p className="kairos-lede mt-6">
              Chat gives you fluent text. Search gives you raw hits. Kairos reads
              across your whole library, chooses the passages that answer the
              question, and cites each one.
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {PRINCIPLES.map((item) => (
                <div key={item.number} className="kairos-dark-card p-5">
                  <div className="flex items-center justify-between">
                    <item.icon className="size-4 text-primary" strokeWidth={1.6} />
                    <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground/70">
                      {item.number}
                    </span>
                  </div>
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {item.label}
                  </p>
                  <h3 className="mt-2 font-serif text-[17px] leading-snug text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <Link
              href="#features"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Explore the features
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <div className="kairos-dark-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/55">
              Evidence set / decoded
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-primary">
              <Quote className="size-3" />
              grounded
            </span>
          </div>

          <div className="space-y-5 p-5 sm:p-7">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm border border-border bg-surface/60 px-3.5 py-2.5 text-[12px] text-foreground/80">
              What changed in the attention design?
            </div>

            <div>
              <p className="font-serif text-[20px] leading-snug text-foreground">
                Recurrence gives way to attention over the full sequence.
              </p>
              <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
                The claim is assembled from selected passages, not from an
                unattributed summary. Each source stays open for inspection.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { source: "PDF", locator: "p. 3 · architecture" },
                { source: "Transcript", locator: "04:18 · retrieval" },
                { source: "Web page", locator: "§ methods" },
              ].map((citation) => (
                <div
                  key={citation.source}
                  className="rounded-xl border border-border bg-surface/60 px-3 py-2.5"
                >
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-primary">
                    {citation.source}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{citation.locator}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
            Illustrative evidence view · no live query is executed here
          </div>
          </div>
        </ScrollReveal>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-background"
      />
    </section>
  );
}
