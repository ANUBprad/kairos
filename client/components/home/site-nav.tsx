"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { cn } from "@/lib/utils";
import { GithubIcon } from "./brand-icons";
import { DOCS_URL, GITHUB_URL } from "./links";

interface SiteNavProps {
  isAuthenticated?: boolean;
}

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#workflow", label: "Workflow" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteNav({ isAuthenticated = false }: SiteNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaHref = isAuthenticated ? "/dashboard" : "/login";
  const ctaLabel = isAuthenticated ? "Dashboard" : "Log in";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        isScrolled || isMenuOpen
          ? "border-border bg-background/90 backdrop-blur-xl"
          : "border-transparent bg-background/55 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" aria-label="Kairos home" className="flex items-center">
          <KairosLogo size={26} textSize="text-[17px]" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
            <ArrowUpRight className="size-3" />
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Kairos on GitHub"
            className="hidden text-muted-foreground/70 transition-colors hover:text-foreground sm:inline-flex"
          >
            <GithubIcon />
          </a>
          <ThemeToggle />
          <Link
            href={ctaHref}
            className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-all hover:brightness-110 sm:inline-flex"
          >
            {ctaLabel}
            <ArrowUpRight className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            {isMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <nav
          className="border-t border-border bg-background/95 px-5 py-4 backdrop-blur-xl md:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Docs
              <ArrowUpRight className="size-4" />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              GitHub
              <ArrowUpRight className="size-4" />
            </a>
            <Link
              href={ctaHref}
              onClick={() => setIsMenuOpen(false)}
              className="mt-2 flex items-center justify-between rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground sm:hidden"
            >
              {ctaLabel}
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
