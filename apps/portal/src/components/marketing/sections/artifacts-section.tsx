"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
  SectionWrapper,
  SectionHeading,
  SectionSubheading,
} from "@/components/marketing/section-wrapper";
import {
  ARTIFACT_TYPE_META,
  ACTIVE_STUDIO_ARTIFACT_TYPES,
} from "@/components/app/studio/artifact-type-meta";

export function ArtifactsSection() {
  return (
    <SectionWrapper id="artifacts">
      <SectionHeading>Turn research into something you can use</SectionHeading>
      <SectionSubheading>
        Select any sources in your workspace and generate study-ready artifacts from them —
        each one grounded in the material you provided.
      </SectionSubheading>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ACTIVE_STUDIO_ARTIFACT_TYPES.map((type, i) => {
          const meta = ARTIFACT_TYPE_META[type];
          const Icon = meta.Icon;
          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-muted text-brand">
                <Icon size={18} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-text-primary">
                {meta.label}
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
                {meta.description}
              </p>
            </motion.div>
          );
        })}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45, delay: ACTIVE_STUDIO_ARTIFACT_TYPES.length * 0.06 }}
          className="flex flex-col justify-center rounded-xl border border-dashed border-brand/40 bg-brand-muted p-6"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Sparkles size={18} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold text-text-primary">
            Your workspace
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
            Everything is organized per workspace, so your sources, research, and
            artifacts stay together.
          </p>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
