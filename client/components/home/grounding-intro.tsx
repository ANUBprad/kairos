import React from "react";
import { ArrowRight, FileQuestion, Layers3 } from "lucide-react";

const COLUMNS = [
  {
    icon: FileQuestion,
    label: "the question",
    title: "Where did this claim come from?",
    body: "A fluent answer is not evidence. Kairos keeps the passage, page, or timestamp attached to every statement it makes.",
  },
  {
    icon: Layers3,
    label: "the retrieval",
    title: "What should the model actually read?",
    body: "Kairos selects the passages that answer your question, keeps them inside the context budget, and presents one grounded evidence set.",
  },
];

export function GroundingIntro() {
  return (
    <section id="grounding" className="scroll-mt-24 px-5 pt-24 sm:px-6 sm:pt-28">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
        <div>
          <p className="kairos-eyebrow">Grounded by design</p>
          <h2 className="kairos-section-title mt-3 text-[30px] sm:text-[38px]">
            Your sources are uploaded.
            <br />
            Your answers still need proof.
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Chat gives you fluent text. Search gives you raw hits. Kairos reads
            across your whole library, chooses the passages that answer the
            question, and cites each one.
          </p>
          <a
            href="#features"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-brand-accent"
          >
            Explore the workflow
            <ArrowRight className="size-4" />
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {COLUMNS.map((column) => (
            <div key={column.label} className="kairos-panel p-6">
              <div className="kairos-inset inline-flex size-10 items-center justify-center rounded-xl text-primary">
                <column.icon className="size-5" />
              </div>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {column.label}
              </p>
              <h3 className="kairos-section-title mt-2 text-lg">{column.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {column.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
