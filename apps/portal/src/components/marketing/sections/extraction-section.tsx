"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
} from "framer-motion";
import { FileText, Table, Image, Tag, Layers } from "lucide-react";
import { SectionHeader } from "./section-header";
import { useParallax } from "./use-parallax";

const extractItems = [
  { icon: FileText, label: "Paragraphs", count: "247", color: "text-blue-400", bg: "bg-blue-500/10" },
  { icon: Table, label: "Tables", count: "18", color: "text-teal-400", bg: "bg-teal-500/10" },
  { icon: Image, label: "Figures", count: "34", color: "text-purple-400", bg: "bg-purple-500/10" },
  { icon: Tag, label: "Metadata", count: "12", color: "text-amber-400", bg: "bg-amber-500/10" },
];

const POSITIONS = [
  { x: 160, y: -20 },
  { x: 180, y: 60 },
  { x: 160, y: 140 },
  { x: 140, y: 220 },
];

const LINE_WIDTHS = [75, 82, 90, 88, 95, 78, 85, 92];

export function ExtractionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const { ref: parallaxRef, y: parallaxY } = useParallax({ output: [80, 0] });

  return (
    <section
      id="extraction"
      ref={sectionRef}
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            ref={parallaxRef}
            style={{ y: parallaxY }}
            className="relative flex items-center justify-center min-h-[420px] order-2 lg:order-1"
          >
            <div className="relative w-56 h-72">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 rounded-xl border border-border/50 bg-surface/60 shadow-xl overflow-hidden"
              >
                <div className="p-4 space-y-2">
                  <div className="h-2 w-20 rounded-full bg-brand/30 mb-3" />
                  {LINE_WIDTHS.map((w, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full bg-text-tertiary/10"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </motion.div>

              {extractItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 0, y: 0 }}
                    animate={
                      isInView
                        ? { opacity: 1, x: POSITIONS[i].x, y: POSITIONS[i].y }
                        : {}
                    }
                    transition={{
                      delay: 0.6 + i * 0.15,
                      duration: 0.6,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="absolute top-8 left-8"
                  >
                    <motion.div
                      animate={isInView ? { y: [0, -4, 0] } : {}}
                      transition={{
                        duration: 3 + i * 0.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.3,
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-surface/80 shadow-lg"
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${item.bg}`}>
                        <Icon size={12} className={item.color} />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-text-primary leading-tight">
                          {item.count}
                        </div>
                        <div className="text-[9px] text-text-tertiary leading-tight">
                          {item.label}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}

              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }} aria-hidden="true">
                {POSITIONS.map((pos, i) => (
                  <motion.line
                    key={i}
                    x1="112"
                    y1="128"
                    x2={pos.x + 40}
                    y2={pos.y + 48}
                    stroke="rgba(255,90,10,0.15)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
                    transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                  />
                ))}
              </svg>
            </div>
          </motion.div>

          <div className="space-y-6 order-1 lg:order-2">
            <SectionHeader
              number="02 — Extraction"
              icon={<Layers size={12} className="text-blue-400" />}
              title="We understand"
              highlight="documents."
              highlightClassName="text-blue-400"
              description="Kairos parses PDFs at the structural level. Pages separate. Paragraphs lift off. Tables and images are identified. Metadata is extracted. Every element is catalogued."
            />

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-2 gap-3 pt-4"
            >
              {extractItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-surface/40"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.bg}`}>
                      <Icon size={14} className={item.color} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{item.count}</div>
                      <div className="text-[11px] text-text-tertiary">{item.label}</div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
