"use client";

import { useMemo } from "react";
import {
  motion,
} from "framer-motion";
import { TableProperties } from "lucide-react";
import { SectionHeader } from "./section-header";
import { useParallax } from "./use-parallax";

const clusters = [
  {
    label: "Retrieval",
    color: "#3B82F6",
    points: [
      { x: 30, y: 35, size: 10, chunk: "chunk_001" },
      { x: 38, y: 28, size: 8, chunk: "chunk_012" },
      { x: 25, y: 42, size: 7, chunk: "chunk_023" },
      { x: 42, y: 38, size: 6, chunk: "chunk_045" },
    ],
  },
  {
    label: "Evaluation",
    color: "#22C55E",
    points: [
      { x: 65, y: 30, size: 9, chunk: "chunk_003" },
      { x: 72, y: 22, size: 7, chunk: "chunk_015" },
      { x: 60, y: 38, size: 6, chunk: "chunk_028" },
    ],
  },
  {
    label: "Chunking",
    color: "#F59E0B",
    points: [
      { x: 50, y: 65, size: 8, chunk: "chunk_007" },
      { x: 58, y: 58, size: 7, chunk: "chunk_019" },
      { x: 45, y: 72, size: 6, chunk: "chunk_031" },
      { x: 55, y: 70, size: 5, chunk: "chunk_042" },
    ],
  },
];

export function EmbeddingsSection() {
  const { ref: parallaxRef, y: parallaxY } = useParallax({ output: [60, 0] });

  const gridLines = useMemo(
    () =>
      Array.from({ length: 11 }).map((_, i) => ({
        x: i * 10,
        y: i * 10,
      })),
    []
  );

  return (
    <section
      id="embeddings"
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <SectionHeader
              number="04 — Embeddings"
              icon={<TableProperties size={12} className="text-violet-400" />}
              title="Meaning becomes"
              highlight="geometry."
              highlightClassName="text-violet-400"
              description="Each chunk transforms into a high-dimensional vector. Related concepts cluster together. Unrelated content separates. Kairos makes this invisible mathematics visible."
            />

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="space-y-4 pt-4"
            >
              {clusters.map((cluster, i) => (
                <motion.div
                  key={cluster.label}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cluster.color }}
                  />
                  <div>
                    <span className="text-sm font-semibold text-text-primary">
                      {cluster.label} Cluster
                    </span>
                    <span className="text-xs text-text-tertiary ml-2">
                      {cluster.points.length} chunks
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.div
            ref={parallaxRef}
            style={{ y: parallaxY }}
            className="relative flex items-center justify-center min-h-[420px]"
          >
            <div className="relative w-full max-w-md aspect-square">
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full"
                aria-hidden="true"
              >
                {gridLines.map((line) => (
                  <g key={`grid-${line.x}`}>
                    <line
                      x1={line.x}
                      y1="0"
                      x2={line.x}
                      y2="100"
                      stroke="rgba(255,255,255,0.03)"
                      strokeWidth="0.3"
                    />
                    <line
                      x1="0"
                      y1={line.y}
                      x2="100"
                      y2={line.y}
                      stroke="rgba(255,255,255,0.03)"
                      strokeWidth="0.3"
                    />
                  </g>
                ))}
              </svg>

              {clusters.map((cluster, ci) => {
                const avgX =
                  cluster.points.reduce((s, p) => s + p.x, 0) /
                  cluster.points.length;
                const avgY =
                  cluster.points.reduce((s, p) => s + p.y, 0) /
                  cluster.points.length;
                return (
                  <motion.div
                    key={`label-${cluster.label}`}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 0.6 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1.5 + ci * 0.2, duration: 0.5 }}
                    className="absolute text-[10px] font-semibold pointer-events-none"
                    style={{
                      left: `${avgX}%`,
                      top: `${avgY - 10}%`,
                      color: cluster.color,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {cluster.label}
                  </motion.div>
                );
              })}

              {clusters.map((cluster) =>
                cluster.points.map((point, pi) => (
                  <motion.div
                    key={point.chunk}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: 0.8 + pi * 0.1,
                      duration: 0.5,
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                    }}
                    className="absolute group"
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <motion.div
                      animate={{
                        boxShadow: [
                          `0 0 0 0 ${cluster.color}00`,
                          `0 0 12px 2px ${cluster.color}30`,
                          `0 0 0 0 ${cluster.color}00`,
                        ],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: pi * 0.5,
                      }}
                      className="rounded-full cursor-default"
                      style={{
                        width: point.size * 2.5,
                        height: point.size * 2.5,
                        backgroundColor: `${cluster.color}60`,
                        border: `1.5px solid ${cluster.color}90`,
                      }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="px-2 py-1 rounded bg-surface border border-border text-[9px] font-mono text-text-secondary whitespace-nowrap shadow-lg">
                        {point.chunk}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}

              <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
                {clusters.map((cluster) =>
                  cluster.points.slice(1).map((point, pi) => {
                    const prev = cluster.points[pi];
                    return (
                      <motion.line
                        key={`line-${cluster.label}-${pi}`}
                        x1={`${prev.x}%`}
                        y1={`${prev.y}%`}
                        x2={`${point.x}%`}
                        y2={`${point.y}%`}
                        stroke={cluster.color}
                        strokeWidth="0.5"
                        strokeOpacity="0.2"
                        initial={{ pathLength: 0, opacity: 0 }}
                        whileInView={{ pathLength: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 1.2 + pi * 0.1, duration: 0.5 }}
                      />
                    );
                  })
                )}
              </svg>

              <div className="absolute inset-0 rounded-2xl border border-border/30" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
