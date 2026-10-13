"use client";

import { motion } from "framer-motion";
import {
  FolderOpen,
  MessagesSquare,
  Layers,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import {
  SectionWrapper,
  SectionHeading,
  SectionSubheading,
} from "@/components/marketing/section-wrapper";

interface Step {
  number: string;
  Icon: LucideIcon;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: "01",
    Icon: FolderOpen,
    title: "Bring your sources",
    description:
      "Upload PDFs, DOCX, Markdown, or paste your notes. Kairos reads everything you give it and keeps your originals intact.",
  },
  {
    number: "02",
    Icon: MessagesSquare,
    title: "Understand them",
    description:
      "Ask questions in plain language. Every answer is grounded in your sources and cites the exact passages it draws from.",
  },
  {
    number: "03",
    Icon: Layers,
    title: "Create from them",
    description:
      "Turn any set of sources into summaries, reports, quizzes, flashcards, mind maps, takeaways, or a two-host podcast.",
  },
  {
    number: "04",
    Icon: GraduationCap,
    title: "Learn from them",
    description:
      "Study with quizzes and flashcards built from your material. Kairos tracks what you know and where you need a second pass.",
  },
];

export function WorkflowSection() {
  return (
    <SectionWrapper id="how-it-works">
      <SectionHeading>Bring it. Understand it. Create from it. Learn it.</SectionHeading>
      <SectionSubheading>
        Kairos is one workspace for the whole research cycle — from raw materials to
        knowledge you can actually keep.
      </SectionSubheading>

      <ol className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const Icon = step.Icon;
          return (
            <motion.li
              key={step.number}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="bg-bg p-7"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-muted text-brand">
                  <Icon size={18} />
                </span>
                <span className="font-mono text-[12px] tracking-widest text-text-tertiary">
                  {step.number}
                </span>
              </div>
              <h3 className="mt-5 text-[16px] font-semibold text-text-primary">
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                {step.description}
              </p>
            </motion.li>
          );
        })}
      </ol>
    </SectionWrapper>
  );
}
