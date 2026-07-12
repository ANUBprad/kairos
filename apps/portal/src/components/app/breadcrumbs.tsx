"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";

export function Breadcrumbs() {
  const { breadcrumbs } = useWorkspace();

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href="/app"
        className="flex items-center gap-1 text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <Home size={14} />
      </Link>
      {breadcrumbs.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight size={12} className="text-text-tertiary/40" />
          {item.href ? (
            <Link
              href={item.href}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-text-primary">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
