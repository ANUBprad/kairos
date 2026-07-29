"use client";

import { PageHeader } from "@/components/app/page-header";
import { RegressionTesting } from "@/components/evaluation/regression-testing";

export function RegressionClient() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Regression Testing"
        description="Test prompt versions against golden datasets and detect regressions."
        purpose="Ensure prompt changes don't degrade performance."
        relatedPages={[
          { label: "Golden Datasets", href: "/app/datasets" },
          { label: "Prompt Library", href: "/app/prompts" },
          { label: "Quality Gates", href: "/app/quality-gates" },
        ]}
      />

      <RegressionTesting />
    </div>
  );
}
