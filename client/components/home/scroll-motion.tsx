"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: CSSProperties;
}

/**
 * Reveals a block once, then leaves it stable. The initial server render is
 * visible so content remains available if hydration never happens.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  style,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;

    const show = () => {
      element.dataset.visible = "true";
      observer?.disconnect();
    };

    const configure = () => {
      observer?.disconnect();

      if (media.matches || typeof IntersectionObserver === "undefined") {
        show();
        return;
      }

      element.dataset.visible = "false";
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) show();
        },
        { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
      );
      observer.observe(element);
    };

    configure();
    media.addEventListener("change", configure);

    return () => {
      media.removeEventListener("change", configure);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      data-visible="true"
      className={cn("kairos-reveal", className)}
      style={{ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
