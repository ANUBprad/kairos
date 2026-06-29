"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";

const companies = [
  "TechCorp",
  "DataFlow",
  "AILabs",
  "CloudNine",
  "StackBase",
  "NexGen",
];

export function SocialProof() {
  return (
    <SectionWrapper className="pt-0 pb-12 md:pb-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-center text-[11px] font-semibold text-text-tertiary uppercase tracking-[0.12em] mb-8">
          Trusted by engineering teams building the future
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {companies.map((name) => (
            <div
              key={name}
              className="h-5 flex items-center text-text-tertiary/30 font-semibold text-[13px] tracking-wide select-none"
            >
              {name}
            </div>
          ))}
        </div>
      </motion.div>
    </SectionWrapper>
  );
}
