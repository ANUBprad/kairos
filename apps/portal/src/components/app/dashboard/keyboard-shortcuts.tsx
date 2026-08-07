"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: Record<string, string> = {
  u: "/app/knowledge-bases",
  n: "/app/knowledge-bases",
  r: "/app/rag-chat",
  e: "/app/evaluation",
};

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("[contenteditable]")
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except shift for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();
      const href = SHORTCUTS[key];
      if (href) {
        e.preventDefault();
        router.push(href);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
