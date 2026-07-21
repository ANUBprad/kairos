"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

type ReducedMotionValue = "always" | "never" | "user" | "undefined";

export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState<ReducedMotionValue>("undefined");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches ? "always" : "undefined");
    const handler = (e: MediaQueryListEvent) =>
      setReducedMotion(e.matches ? "always" : "undefined");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <MotionConfig reducedMotion={reducedMotion as "always" | "never" | "user" | undefined}>
      {children}
    </MotionConfig>
  );
}
