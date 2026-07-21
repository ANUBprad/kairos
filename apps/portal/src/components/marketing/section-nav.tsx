"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const sections = [
  { id: "hero", label: "Welcome" },
  { id: "upload", label: "Upload" },
  { id: "extraction", label: "Extraction" },
  { id: "chunking", label: "Chunking" },
  { id: "embeddings", label: "Embeddings" },
  { id: "retrieval", label: "Retrieval" },
  { id: "reranking", label: "Reranking" },
  { id: "generation", label: "Generation" },
  { id: "evaluation", label: "Evaluation" },
  { id: "architecture", label: "Architecture" },
];

export function SectionNav() {
  const [active, setActive] = useState("hero");
  const [isHovered, setIsHovered] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const visibleSections = new Map<string, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        let bestId = "hero";
        let bestRatio = 0;
        visibleSections.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });
        setActive(bestId);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-10% 0px -10% 0px" }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return (
    <nav
      className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-end gap-2"
      aria-label="Section navigation"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => scrollTo(section.id)}
          className="group flex items-center gap-3 py-1"
          aria-label={`Go to ${section.label}`}
          aria-current={active === section.id ? "true" : undefined}
        >
          <AnimatePresence>
            {isHovered && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "text-[11px] font-medium transition-colors duration-200 whitespace-nowrap",
                  active === section.id
                    ? "text-brand"
                    : "text-text-tertiary group-hover:text-text-secondary"
                )}
              >
                {section.label}
              </motion.span>
            )}
          </AnimatePresence>
          <div className="relative flex items-center justify-center">
            <motion.div
              className={cn(
                "rounded-full transition-all duration-300",
                active === section.id
                  ? "w-2.5 h-2.5 bg-brand"
                  : "w-1.5 h-1.5 bg-text-tertiary/40 group-hover:bg-text-tertiary"
              )}
              layout
            />
            {active === section.id && (
              <motion.div
                layoutId="activeRing"
                className="absolute inset-0 rounded-full border border-brand/40"
                style={{ width: 18, height: 18, marginLeft: -3.25, marginTop: -3.25 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
          </div>
        </button>
      ))}
    </nav>
  );
}
