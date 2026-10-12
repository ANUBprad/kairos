"use client";

import { PageHeader } from "@/components/app/page-header";
import { Leaderboards, type LeaderboardRowEntry } from "@/components/evaluation/leaderboards";

export function LeaderboardsClient({ entries }: { entries: LeaderboardRowEntry[] }) {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Leaderboards"
        description="Rank and compare your completed benchmark runs."
        purpose="Track the top-performing configurations across your workspace."
        relatedPages={[
          { label: "Research Analytics", href: "/app/research/analytics" },
          { label: "Quality Gates", href: "/app/quality-gates" },
          { label: "Experiment Builder", href: "/app/experiment-builder" },
        ]}
      />

      <Leaderboards entries={entries} />
    </div>
  );
}