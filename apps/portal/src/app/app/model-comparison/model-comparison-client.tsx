"use client";

import { PageHeader } from "@/components/app/page-header";
import { ModelComparison } from "@/components/evaluation/model-comparison";

export function ModelComparisonClient() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Model Comparison"
        description="Compare multiple LLM providers side by side."
        purpose="Evaluate latency, cost, quality, and other metrics across models."
        relatedPages={[
          { label: "Leaderboards", href: "/app/leaderboards" },
          { label: "Prompt Playground", href: "/app/prompts" },
          { label: "Analytics", href: "/app/analytics" },
        ]}
      />

      <ModelComparison />
    </div>
  );
}
