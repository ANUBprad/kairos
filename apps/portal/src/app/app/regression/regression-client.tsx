"use client";

import { PageHeader } from "@/components/app/page-header";
import { RegressionCompare } from "@/components/evaluation/regression-compare";

export function RegressionClient() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Regression Testing"
        description="Compare two benchmark runs on the same dataset and detect statistically significant regressions."
        purpose="Make sure performance doesn't regress between runs."
        relatedPages={[
          { label: "Golden Datasets", href: "/app/datasets" },
          { label: "Evaluation", href: "/app/evaluation" },
          { label: "Quality Gates", href: "/app/quality-gates" },
        ]}
      />

      <RegressionCompare />
    </div>
  );
}