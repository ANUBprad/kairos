import React from "react";
import {
  AudioLines,
  LibraryBig,
  MessageSquareQuote,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

interface Feature {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: [string, string];
  body: string;
}

const FEATURES: Feature[] = [
  {
    id: "chat",
    icon: MessageSquareQuote,
    eyebrow: "Cited chat",
    title: ["A cited answer,", "not a confident guess."],
    body: "Every reply points back to the passage it came from — the page of the PDF, the timestamp in the video, the paragraph on the page. You can check the claim instead of trusting it.",
  },
  {
    id: "source-library",
    icon: LibraryBig,
    eyebrow: "Unified library",
    title: ["Connect the sources", "your work already uses."],
    body: "Import from Google Drive and Notion, drop in PDFs, paste a URL, or pull a YouTube transcript. Everything lands in one library your workspace can reason over.",
  },
  {
    id: "podcast",
    icon: AudioLines,
    eyebrow: "Interrupt & ask",
    title: ["A podcast you can", "interrupt mid-sentence."],
    body: "Pause an episode at any timestamp, ask a question, and hear an answer grounded in your notes before the show picks back up.",
  },
  {
    id: "studio",
    icon: Sparkles,
    eyebrow: "Study studio",
    title: ["Flashcards, quizzes,", "and mind maps on tap."],
    body: "Studio turns the same library into summaries, key takeaways, flashcards, practice quizzes, and mind maps. Memory keeps your preferences between workspaces.",
  },
];

const WAVEFORM = [10, 18, 28, 16, 34, 22, 38, 26, 14, 30, 42, 24, 18, 32, 20, 12, 28, 36, 16, 24];

function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </span>
  );
}

function FeaturePreview({ id }: { id: string }) {
  if (id === "chat") {
    return (
      <div className="mt-8 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <PreviewLabel>Illustrative answer</PreviewLabel>
          <span className="font-mono text-[9px] text-processing-deep">3 citations</span>
        </div>
        <div className="ml-auto mt-4 w-fit max-w-[85%] rounded-xl rounded-br-sm bg-navy px-3 py-2 text-[11px] text-white">
          What does the paper actually replace?
        </div>
        <p className="mt-3 font-serif text-[17px] leading-snug text-foreground">
          Recurrence, with attention across the full sequence.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["pdf · p.3", "transcript · 04:18", "web · § methods"].map((source) => (
            <span
              key={source}
              className="rounded-full border border-processing/25 bg-processing/10 px-2 py-1 font-mono text-[9px] text-processing-deep"
            >
              {source}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (id === "source-library") {
    return (
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-background">
        <div className="border-b border-border px-4 py-3">
          <PreviewLabel>Illustrative library</PreviewLabel>
        </div>
        <div className="divide-y divide-border">
          {[
            { type: "PDF", title: "Attention Is All You Need" },
            { type: "WEB", title: "Research notes / methods" },
            { type: "VIDEO", title: "How retrieval works" },
            { type: "DRIVE", title: "Project brief" },
          ].map((row) => (
            <div key={row.title} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-12 shrink-0 font-mono text-[9px] tracking-[0.12em] text-primary">
                {row.type}
              </span>
              <span className="truncate text-[12px] text-foreground">{row.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === "podcast") {
    return (
      <div className="mt-8 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <PreviewLabel>Illustrative episode</PreviewLabel>
          <span className="font-mono text-[9px] text-processing-deep">04:18 / 18:42</span>
        </div>
        <div className="mt-5 flex h-14 items-end gap-1">
          {WAVEFORM.map((height, index) => (
            <span
              key={index}
              className="flex-1 rounded-full bg-primary/25"
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-processing/25 bg-processing/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-processing-deep">
          Paused at 04:18 · ask a question
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-4 sm:grid-cols-4">
      {[
        { label: "Summary", detail: "key points" },
        { label: "Flashcards", detail: "recall set" },
        { label: "Quiz", detail: "practice" },
        { label: "Mind map", detail: "connections" },
      ].map((artifact) => (
        <div key={artifact.label} className="rounded-lg border border-border bg-surface p-3">
          <span className="block font-serif text-[15px] text-foreground">{artifact.label}</span>
          <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {artifact.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FeatureRows() {
  return (
    <section id="features" className="scroll-mt-24 border-t border-border bg-background py-24 sm:py-28">
      <div className="kairos-section-wrap">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <div>
            <p className="kairos-kicker">One library, four ways to use it</p>
            <h2 className="kairos-editorial-title mt-4 text-[34px] sm:text-[46px]">
              Built for the moment research turns into understanding.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            The same grounded library powers the chat, source workspace, podcast
            and study artifacts. Nothing is generated in isolation from your
            evidence.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-12">
          {FEATURES.map((feature, index) => {
            const span = index === 0 || index === 3 ? "lg:col-span-7" : "lg:col-span-5";
            return (
              <article
                key={feature.id}
                id={feature.id}
                className={`kairos-panel scroll-mt-24 p-6 sm:p-7 ${span}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-primary">
                    <feature.icon className="size-5" strokeWidth={1.6} />
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-processing-deep">
                  {feature.eyebrow}
                </p>
                <h3 className="kairos-editorial-title mt-2 text-[26px] sm:text-[30px]">
                  {feature.title[0]}
                  <br />
                  {feature.title[1]}
                </h3>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>

                <FeaturePreview id={feature.id} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
