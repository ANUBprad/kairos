"use client";

import { PageHeader } from "@/components/app/page-header";
import { Leaderboards } from "@/components/evaluation/leaderboards";

export function LeaderboardsClient() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Leaderboards"
        description="Rank and compare prompts, models, retrievers, and experiments."
        purpose="Track the top performers across your evaluation platform."
        relatedPages={[
          { label: "Analytics", href: "/app/analytics" },
          { label: "Quality Gates", href: "/app/quality-gates" },
          { label: "Experiments", href: "/app/experiment-builder" },
        ]}
      />

      <Leaderboards />
    </div>
  );
}
