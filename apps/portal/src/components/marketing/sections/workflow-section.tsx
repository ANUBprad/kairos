"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { FolderOpen, MessagesSquare, Layers, GraduationCap, type LucideIcon } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "@/components/marketing/section-wrapper";

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
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <SectionWrapper id="how-it-works">
      <SectionHeading>Bring it. Understand it. Create from it. Learn it.</SectionHeading>
      <SectionSubheading>
        Kairos is one workspace for the whole research cycle — from raw materials to
        knowledge you can actually keep.
      </SectionSubheading>

      <div ref={ref} className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.12 }}
            className="relative rounded-2xl border border-border/60 bg-surface/40 p-6"
          >
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center">
                <step.Icon size={20} className="text-brand" />
              </div>
              <span className="text-[11px] font-semibold tracking-widest text-text-tertiary">
                {step.number}
              </span>
            </div>
            <h3 className="mt-5 text-[16px] font-semibold text-text-primary">{step.title}</h3>
            <p className="mt-2 text-[13.5px] text-text-secondary leading-relaxed">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}