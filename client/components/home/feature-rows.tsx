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
  tone: "primary" | "brand" | "accent" | "success";
}

const FEATURES: Feature[] = [
  {
    id: "chat",
    icon: MessageSquareQuote,
    eyebrow: "Cited chat",
    title: ["A cited answer,", "not a confident guess."],
    body: "Every reply points back to the passage it came from — the page of the PDF, the timestamp in the video, the paragraph on the page. You can check the claim instead of trusting it.",
    tone: "primary",
  },
  {
    id: "sources",
    icon: LibraryBig,
    eyebrow: "Unified library",
    title: ["Connect the sources", "your work already uses."],
    body: "Import from Google Drive and Notion, drop in PDFs, paste a URL, or pull a YouTube transcript. Everything lands in one library your workspace can reason over.",
    tone: "brand",
  },
  {
    id: "podcast",
    icon: AudioLines,
    eyebrow: "Interrupt & ask",
    title: ["A podcast you can", "interrupt mid-sentence."],
    body: "Pause an episode at any timestamp, ask a question, and hear an answer grounded in your notes before the show picks back up.",
    tone: "success",
  },
  {
    id: "studio",
    icon: Sparkles,
    eyebrow: "Study studio",
    title: ["Flashcards, quizzes,", "and mind maps on tap."],
    body: "Studio turns the same library into summaries, key takeaways, flashcards, practice quizzes, and mind maps. Memory keeps your preferences between workspaces.",
    tone: "accent",
  },
];

const TONE_CLASS: Record<Feature["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  brand: "bg-brand-soft text-primary",
  accent: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
};

export function FeatureRows() {
  return (
    <section id="features" className="scroll-mt-24 px-5 pt-24 sm:px-6 sm:pt-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-2xl">
          <p className="kairos-eyebrow">One library, four ways to use it</p>
          <h2 className="kairos-section-title mt-3 text-[30px] sm:text-[38px]">
            Built for the moment research turns into understanding.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <article key={feature.id} id={feature.id} className="kairos-card scroll-mt-24 p-6 sm:p-7">
              <div
                className={`inline-flex size-11 items-center justify-center rounded-2xl ${TONE_CLASS[feature.tone]}`}
              >
                <feature.icon className="size-5" />
              </div>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {feature.eyebrow}
              </p>
              <h3 className="kairos-section-title mt-2 text-[24px]">
                {feature.title[0]}
                <br />
                {feature.title[1]}
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
