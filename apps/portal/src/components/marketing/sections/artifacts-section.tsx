"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "@/components/marketing/section-wrapper";
import { ARTIFACT_TYPE_META, ACTIVE_STUDIO_ARTIFACT_TYPES } from "@/components/app/studio/artifact-type-meta";

export function ArtifactsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <SectionWrapper id="artifacts">
      <SectionHeading>Turn research into something you can use</SectionHeading>
      <SectionSubheading>
        Select any sources in your workspace and generate study-ready artifacts from them —
        each one grounded in the material you provided.
      </SectionSubheading>

      <div ref={ref} className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ACTIVE_STUDIO_ARTIFACT_TYPES.map((type, i) => {
          const meta = ARTIFACT_TYPE_META[type];
          const Icon = meta.Icon;
          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-border/60 bg-surface/40 p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Icon size={18} className="text-success" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-text-primary">{meta.label}</h3>
              <p className="mt-1.5 text-[13px] text-text-secondary leading-relaxed">
                {meta.description}
              </p>
            </motion.div>
          );
        })}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: ACTIVE_STUDIO_ARTIFACT_TYPES.length * 0.08 }}
          className="rounded-2xl border border-dashed border-brand/40 bg-brand/5 p-6 flex flex-col justify-center"
        >
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
            <Sparkles size={18} className="text-brand" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold text-text-primary">Your workspace</h3>
          <p className="mt-1.5 text-[13px] text-text-secondary leading-relaxed">
            Everything is organized per workspace, so your sources, research, and artifacts stay
            together.
          </p>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}