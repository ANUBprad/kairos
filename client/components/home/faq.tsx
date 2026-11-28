"use client";

import React from "react";
import { Accordion } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "What is Kairos?",
    answer:
      "A research workspace for turning sources into answers you can verify. Add material to a workspace, chat with it, generate study artifacts, and listen to a podcast built from the same library.",
  },
  {
    question: "What can I add as a source?",
    answer:
      "PDFs, web pages, YouTube videos, Google Drive files, Notion pages, Markdown, and raw text. Web pages and videos are normalized into searchable text like any other document.",
  },
  {
    question: "How do citations work?",
    answer:
      "Sources are chunked and indexed for retrieval. Each answer is assembled from the passages selected for your question, and the response carries citations back to those passages.",
  },
  {
    question: "What is Interrupt & Ask?",
    answer:
      "While an episode is playing you can pause at any timestamp and ask a question. The answer comes from your sources, then the episode resumes where you left it.",
  },
  {
    question: "Can it search the live web?",
    answer:
      "Yes. Toggle web search in the chat input when a question needs something outside your library. Those results are cited alongside your own sources.",
  },
  {
    question: "Does Memory carry across workspaces?",
    answer:
      "Memory keeps a profile of what you are working on and how you like answers framed, so a new workspace does not start from zero. You can inspect and clear it from settings at any time.",
  },
  {
    question: "How does pricing work?",
    answer:
      "New accounts receive a one-time welcome bonus, and every account gets free credits each server-defined window. Paid top-ups never expire; unused free-window credits expire at the next server-provided reset. Plan access is a finite one-time purchase, with no recurring subscription. Each action shows its credit cost before you confirm it.",
  },
  {
    question: "Can I control my saved sources and artifacts?",
    answer:
      "Yes. Sources, artifacts, conversations, and memories are visible in your workspace and settings, where you can review or delete them.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-10 px-5 pb-24 pt-24 sm:px-6 sm:pb-28 sm:pt-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20"
    >
      <div>
        <p className="kairos-eyebrow">Good questions</p>
        <h2 className="kairos-section-title mt-3 text-[30px] sm:text-[38px]">
          The practical
          <br />
          bits, answered.
        </h2>
        <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          What Kairos grounds, what it generates for you, and what stays under
          your control.
        </p>
      </div>

      <div className="kairos-panel px-5 py-2 sm:px-7">
        <Accordion.Root className="flex w-full flex-col">
          {FAQS.map((faq) => (
            <Accordion.Item
              key={faq.question}
              value={faq.question}
              className="border-b border-border last:border-0"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group/trigger flex w-full items-center justify-between gap-6 py-5 text-left text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  {faq.question}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/trigger:rotate-180" />
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Panel className="overflow-hidden data-closed:animate-accordion-up data-open:animate-accordion-down">
                <p className="h-(--accordion-panel-height) max-w-xl pb-5 text-sm leading-relaxed text-muted-foreground data-ending-style:h-0 data-starting-style:h-0">
                  {faq.answer}
                </p>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
