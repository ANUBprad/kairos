import React from "react";

interface UseCase {
  number: string;
  title: string;
  body: string;
  signals: string[];
}

const USE_CASES: UseCase[] = [
  {
    number: "01",
    title: "Research and learning",
    body: "Read across a paper set, keep citations beside your notes, and ask follow-ups without losing the passage behind an answer.",
    signals: ["Paper sets", "Cited notes", "Follow-up questions"],
  },
  {
    number: "02",
    title: "Document intelligence",
    body: "Turn PDFs, web pages and transcripts into one searchable library with source identity intact.",
    signals: ["PDF", "Web", "Transcript"],
  },
  {
    number: "03",
    title: "Knowledge discovery",
    body: "Find the connection between a claim in a document and a timestamp in a video, then open both in context.",
    signals: ["Passage match", "Timestamp", "Open source"],
  },
  {
    number: "04",
    title: "Study and content creation",
    body: "Use the same evidence to produce summaries, key takeaways, flashcards, practice quizzes, mind maps and a podcast.",
    signals: ["Studio", "Flashcards", "Podcast"],
  },
  {
    number: "05",
    title: "Source-grounded conversations",
    body: "Ask across the library in chat, inspect the selected passages, and optionally bring cited web results into the same answer.",
    signals: ["Cited chat", "Evidence set", "Web search toggle"],
  },
];

export function UseCases() {
  return (
    <section
      id="use-cases"
      className="scroll-mt-24 border-b border-border bg-surface py-24 sm:py-28"
    >
      <div className="kairos-section-wrap">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <div>
            <p className="kairos-kicker">Use cases</p>
            <h2 className="kairos-editorial-title mt-4 text-[34px] sm:text-[46px]">
              For the work that starts with a question.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Kairos stays useful from the first read to the final artifact because
            every step returns to the same evidence.
          </p>
        </div>

        <div className="mt-12 border-t border-border">
          {USE_CASES.map((useCase) => (
            <article
              key={useCase.number}
              className="grid gap-4 border-b border-border py-7 last:border-0 md:grid-cols-[64px_minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-8 md:py-8"
            >
              <span className="font-mono text-[11px] tracking-[0.18em] text-processing-deep">
                {useCase.number}
              </span>
              <div>
                <h3 className="font-serif text-[22px] leading-snug text-foreground sm:text-[26px]">
                  {useCase.title}
                </h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {useCase.signals.map((signal) => (
                    <span
                      key={signal}
                      className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {useCase.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
