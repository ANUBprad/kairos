"use client";

import { PageHeader } from "@/components/app/page-header";
import { AnalyticsDashboard } from "@/components/evaluation/analytics-dashboard";

export function AnalyticsClient() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Analytics"
        description="Real production metrics: requests, latency, errors, cost, and drift."
        purpose="Review real metrics collected from traces and cost ledgering."
        relatedPages={[
          { label: "Observability", href: "/app/observability" },
          { label: "Leaderboards", href: "/app/leaderboards" },
          { label: "Quality Gates", href: "/app/quality-gates" },
          { label: "Evaluations", href: "/app/evaluation" },
        ]}
      />

      <AnalyticsDashboard />
    </div>
  );
}
