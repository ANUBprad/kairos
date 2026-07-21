"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
} from "framer-motion";
import { Layers, ArrowDown } from "lucide-react";
import { SectionHeader } from "./section-header";
import { useParallax } from "./use-parallax";

const layers = [
  { label: "Next.js", sublabel: "Frontend & SSR", color: "from-blue-500/20 to-blue-600/20", border: "border-blue-500/30", dotColor: "bg-blue-500" },
  { label: "Go Gateway", sublabel: "API & Auth", color: "from-cyan-500/20 to-cyan-600/20", border: "border-cyan-500/30", dotColor: "bg-cyan-500" },
  { label: "Python Intelligence", sublabel: "AI & Embeddings", color: "from-emerald-500/20 to-emerald-600/20", border: "border-emerald-500/30", dotColor: "bg-emerald-500" },
  { label: "Rust Acceleration", sublabel: "Future-ready", color: "from-amber-500/20 to-amber-600/20", border: "border-amber-500/30", dotColor: "bg-amber-500", badge: "Future" },
  { label: "PostgreSQL", sublabel: "Primary Database", color: "from-violet-500/20 to-violet-600/20", border: "border-violet-500/30", dotColor: "bg-violet-500" },
  { label: "Vector Store", sublabel: "pgvector + HNSW", color: "from-rose-500/20 to-rose-600/20", border: "border-rose-500/30", dotColor: "bg-rose-500" },
  { label: "LLMs", sublabel: "GPT-4o, Gemini", color: "from-brand/20 to-brand-hover/20", border: "border-brand/30", dotColor: "bg-brand" },
];

export function ArchitectureSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const { ref: parallaxRef, y: parallaxY } = useParallax({ output: [60, 0] });

  return (
    <section
      id="architecture"
      ref={sectionRef}
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand/3 blur-[150px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="text-center mb-16">
          <SectionHeader
            number="09 — Architecture"
            icon={<Layers size={12} className="text-brand" />}
            title="Built for scale."
            highlight="Designed for clarity."
            description="Every layer of the stack is visible. Every request is traceable. From frontend to database, Kairos exposes the entire pipeline."
            align="center"
          />
        </div>

        <motion.div
          ref={parallaxRef}
          style={{ y: parallaxY }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative">
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.3 }}
              className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-border/60 via-border/30 to-transparent origin-top"
              aria-hidden="true"
            />

            <div className="space-y-3">
              {layers.map((layer, i) => (
                <motion.div
                  key={layer.label}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }}
                  className="relative flex items-center gap-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: 0.5 + i * 0.12,
                      type: "spring",
                      stiffness: 400,
                      damping: 20,
                    }}
                    className="relative z-10 shrink-0"
                  >
                    <div className={`w-4 h-4 rounded-full ${layer.dotColor}`} />
                    <div className={`absolute inset-0 w-4 h-4 rounded-full ${layer.dotColor} animate-ping opacity-20`} aria-hidden="true" />
                  </motion.div>

                  <motion.div
                    whileHover={{ x: 4, scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                    className={`flex-1 rounded-xl border ${layer.border} bg-gradient-to-r ${layer.color} p-4 flex items-center justify-between cursor-default`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {layer.label}
                        </span>
                        {layer.badge && (
                          <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            {layer.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-tertiary">
                        {layer.sublabel}
                      </span>
                    </div>

                    {i < layers.length - 1 && (
                      <ArrowDown size={14} className="text-text-tertiary/30" />
                    )}
                  </motion.div>
                </motion.div>
              ))}
            </div>

            {isInView && (
              <motion.div
                initial={{ top: "0%", opacity: 0 }}
                animate={{ top: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 3, delay: 1.5, ease: "easeInOut" }}
                className="absolute left-[28px] w-2 h-2 rounded-full bg-brand pointer-events-none"
                style={{ boxShadow: "0 0 12px 4px rgba(255,90,10,0.4)" }}
                aria-hidden="true"
              />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
