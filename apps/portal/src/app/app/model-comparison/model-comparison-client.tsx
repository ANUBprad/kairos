"use client";

import { PageHeader } from "@/components/app/page-header";
import { ModelComparison } from "@/components/evaluation/model-comparison";

export function ModelComparisonClient() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Model Comparison"
        description="Compare real collected performance across LLM models."
        purpose="Review latency, requests, tokens, and cost from production traces."
        relatedPages={[
          { label: "Observability", href: "/app/observability" },
          { label: "Leaderboards", href: "/app/leaderboards" },
          { label: "Prompt Playground", href: "/app/prompts" },
          { label: "Analytics", href: "/app/analytics" },
        ]}
      />

      <ModelComparison />
    </div>
  );
}
