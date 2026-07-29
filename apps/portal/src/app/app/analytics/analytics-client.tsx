"use client";

import { PageHeader } from "@/components/app/page-header";
import { AnalyticsDashboard } from "@/components/evaluation/analytics-dashboard";

export function AnalyticsClient() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Analytics"
        description="Monitor quality trends, cost patterns, and evaluation performance."
        purpose="Track your evaluation platform metrics over time."
        relatedPages={[
          { label: "Leaderboards", href: "/app/leaderboards" },
          { label: "Quality Gates", href: "/app/quality-gates" },
          { label: "Evaluations", href: "/app/evaluation" },
        ]}
      />

      <AnalyticsDashboard />
    </div>
  );
}
