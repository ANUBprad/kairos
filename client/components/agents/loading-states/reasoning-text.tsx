"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Sparkles, Brain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReasoningTextVariant = "cascade" | "pulse" | "shimmer" | "fade";

export interface ReasoningTextProps {
  phrases?: string[];
  variant?: ReasoningTextVariant;
  intervalMs?: number;
  className?: string;
  showIcon?: boolean;
  icon?: React.ReactNode;
}

const DEFAULT_PHRASES = [
  "Thinking",
  "Reading the request",
  "Working through the details",
  "Preparing the answer",
];


export function ReasoningText({
  phrases = DEFAULT_PHRASES,
  variant = "cascade",
  intervalMs = 2200,
  className,
  showIcon = true,
  icon,
}: ReasoningTextProps) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    if (reduce || !phrases || phrases.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [phrases, intervalMs, reduce]);

  const currentPhrase = phrases[index] || phrases[0] || "Thinking";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground select-none",
        className
      )}
    >
      {/* Animated Indicator Icon */}
      {showIcon && (
        <div className="relative flex items-center justify-center shrink-0">
          {icon ? (
            icon
          ) : (
            <div className="relative flex items-center justify-center">
              <span className="absolute size-2.5 rounded-full bg-brand/20 motion-safe:animate-ping" />
              <span className="relative size-1.5 rounded-full bg-brand" />
            </div>
          )}
        </div>
      )}

      {/* Text Phrase with Animation */}
      <div className="relative overflow-hidden min-h-[1.25rem] flex items-center">
        <AnimatePresence mode="wait">
          {variant === "cascade" && (
            <motion.span
              key={index}
              initial={reduce ? false : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={
                reduce
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              exit={
                reduce
                  ? { opacity: 1 }
                  : { opacity: 0, y: -6, filter: "blur(2px)" }
              }
              transition={{ duration: reduce ? 0 : 0.28, ease: "easeOut" }}
              className="font-medium tracking-tight truncate text-foreground/85 inline-flex items-center gap-1"
            >
              <span>{currentPhrase}</span>
              <span className="inline-flex gap-0.5 ml-0.5">
                <span className="size-1 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce" />
              </span>
            </motion.span>
          )}

          {variant === "shimmer" && (
            <motion.span
              key={index}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.3 }}
              className="bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_auto] font-medium motion-safe:animate-shimmer bg-clip-text text-transparent"
            >
              {currentPhrase}...
            </motion.span>
          )}

          {variant === "pulse" && (
            <motion.span
              key={index}
              initial={reduce ? { opacity: 1 } : { opacity: 0.4 }}
              animate={reduce ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: reduce ? 0 : 1.5,
                repeat: reduce ? 0 : Infinity,
              }}
              className="font-medium text-foreground/80"
            >
              {currentPhrase}...
            </motion.span>
          )}

          {variant === "fade" && (
            <motion.span
              key={index}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.25 }}
              className="font-medium text-foreground/85"
            >
              {currentPhrase}...
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
