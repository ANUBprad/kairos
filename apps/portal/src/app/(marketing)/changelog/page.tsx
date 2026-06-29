import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Latest updates and improvements to the Kairos platform.",
};

const entries = [
  {
    version: "v1.0.0",
    date: "June 25, 2026",
    tag: "Release" as const,
    title: "Public Beta Launch",
    changes: [
      "Initial public release of the Kairos Adaptive Retrieval Platform",
      "Adaptive query routing with per-query strategy selection",
      "Document ingestion supporting PDF, TXT, and Markdown files",
      "API key authentication with per-project scoping",
      "Email and Google OAuth authentication",
      "Usage analytics dashboard with query volume, latency, and cost metrics",
      "Free tier with 1,000 queries per month",
      "Developer ($49/mo) and Pro ($199/mo) paid tiers",
      "Interactive query workspace with strategy visualization",
      "Full API documentation and Python SDK",
    ],
  },
  {
    version: "v0.9.0",
    date: "June 10, 2026",
    tag: "Release" as const,
    title: "Pre-Launch Release",
    changes: [
      "Performance optimizations across the intelligence pipeline",
      "Improved confidence calibration with Platt scaling and isotonic regression",
      "Reduced P95 latency by 23% through caching optimizations",
      "Bug fixes for edge cases in multi-hop retrieval",
      "Documentation improvements and expanded API reference",
      "Rate limiting implementation per API key",
    ],
  },
  {
    version: "v0.8.0",
    date: "May 28, 2026",
    tag: "Feature" as const,
    title: "Benchmark Integration",
    changes: [
      "Built-in benchmark suite with 1,020 queries across 5 domains",
      "Confidence calibration pipeline with automated evaluation",
      "Strategy comparison tool for A/B testing retrieval approaches",
      "Cost tracking and per-strategy cost analysis",
      "Exportable benchmark results in CSV format",
    ],
  },
  {
    version: "v0.7.0",
    date: "May 15, 2026",
    tag: "Feature" as const,
    title: "Feedback Learning",
    changes: [
      "Feedback collection loop with thumbs up/down on query results",
      "Strategy selector retraining from user feedback signals",
      "Budget optimizer adaptation based on usage patterns",
      "Analytics integration for feedback trends",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="pt-28 pb-24">
      <div className="mx-auto max-w-[720px] px-6 sm:px-8">
        <ScrollReveal className="text-center mb-16">
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">Changelog</h1>
          <p className="mt-4 text-[18px] text-text-secondary">Latest updates and improvements to Kairos.</p>
        </ScrollReveal>

        <div className="relative">
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
          <div className="space-y-12">
            {entries.map((entry, i) => (
              <ScrollReveal key={entry.version} delay={i * 0.08}>
                <div className="relative pl-12">
                  <div className="absolute left-0 top-1 w-[38px] h-[38px] rounded-full bg-surface border border-border flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-brand" />
                  </div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-mono font-bold text-text-primary">{entry.version}</span>
                    <Badge variant={entry.tag === "Release" ? "info" : "success"}>{entry.tag}</Badge>
                  </div>
                  <p className="text-xs text-text-tertiary mb-3">{entry.date}</p>
                  <h2 className="text-base font-semibold text-text-primary mb-3">{entry.title}</h2>
                  <ul className="space-y-2">
                    {entry.changes.map((change, ci) => (
                      <li key={ci} className="flex items-start gap-2 text-sm text-text-tertiary">
                        <span className="text-brand mt-1.5 shrink-0">•</span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <ScrollReveal className="mt-16">
          <div className="p-6 rounded-[14px] border border-border bg-surface/50 text-center">
            <p className="text-sm text-text-tertiary">
              Stay updated with new releases. Follow us on{" "}
              <a href="https://github.com/kairos-ai/kairos" className="text-brand hover:underline" target="_blank" rel="noopener noreferrer">GitHub</a>{" "}
              or subscribe to our{" "}
              <a href="/blog" className="text-brand hover:underline">blog</a>.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
