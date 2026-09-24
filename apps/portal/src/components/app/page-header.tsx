"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
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
          <h1 className="page-title">
            {title}
          </h1>
          {description && <p className="page-description max-w-2xl">{description}</p>}
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

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3" role="navigation" aria-label="Page actions">
        <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <HelpCircle size={13} className="shrink-0 text-brand" aria-hidden="true" />
          {purpose}
        </span>
        {nextAction && (
          <Link
            href={nextAction.href}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-brand transition-colors"
          >
            {nextAction.label}
            <ArrowRight size={12} />
          </Link>
        )}
        {relatedPages && relatedPages.length > 0 && (
          <div className="flex items-center gap-1.5">
            {relatedPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
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
