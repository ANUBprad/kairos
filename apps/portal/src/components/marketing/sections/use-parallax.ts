"use client";

import { useRef } from "react";
import { useScroll, useTransform, type MotionValue } from "framer-motion";

interface UseParallaxOptions {
  offset?: [string, string];
  input?: [number, number];
  output?: [number, number];
}

export function useParallax({
  offset = ["start end", "end start"],
  input = [0, 0.5],
  output = [60, 0],
}: UseParallaxOptions = {}): {
  ref: React.RefObject<HTMLDivElement | null>;
  y: MotionValue<number>;
} {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: offset as ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, input, output);
  return { ref, y };
}
