"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description: string;
  purpose: string;
  nextAction?: { label: string; href: string };
  relatedPages?: { label: string; href: string }[];
  docLink?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  purpose,
  nextAction,
  relatedPages,
  docLink,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6", className)} role="banner">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            {title}
          </h1>
          <p className="text-sm text-text-secondary max-w-2xl">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {docLink && (
            <a
              href={docLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              aria-label={`${title} documentation`}
            >
              <BookOpen size={14} />
              Docs
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-4 rounded-lg border border-border bg-surface/50 px-3 sm:px-4 py-3" role="navigation" aria-label="Page actions">
        <div className="flex items-start gap-2">
          <HelpCircle size={14} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <p className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">Purpose:</span>{" "}
            {purpose}
          </p>
        </div>
        {nextAction && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-text-tertiary">Next:</span>
            <Link
              href={nextAction.href}
              className="flex items-center gap-1 rounded-md bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand/20 transition-colors"
            >
              {nextAction.label}
              <ArrowRight size={12} />
            </Link>
          </div>
        )}
        {relatedPages && relatedPages.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-text-tertiary">Related:</span>
            {relatedPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                {page.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
