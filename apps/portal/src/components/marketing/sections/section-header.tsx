"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

interface SectionHeaderProps {
  number: string;
  icon: ReactNode;
  title: string;
  highlight: string;
  highlightClassName?: string;
  description: string;
  align?: "left" | "center";
}

export function SectionHeader({
  number,
  icon,
  title,
  highlight,
  highlightClassName = "text-brand",
  description,
  align = "left",
}: SectionHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className={align === "center" ? "text-center" : ""}>
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-surface/60 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary mb-6"
      >
        {icon}
        {number}
      </motion.span>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-[1.05] text-text-primary"
      >
        {title}
        <br />
        <span className={highlightClassName}>{highlight}</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.2 }}
        className={`mt-4 text-[16px] text-text-secondary leading-relaxed ${align === "center" ? "max-w-2xl mx-auto" : "max-w-[440px]"}`}
      >
        {description}
      </motion.p>
    </div>
  );
}
