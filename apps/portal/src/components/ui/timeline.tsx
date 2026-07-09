import * as React from "react";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStep {
  id: string;
  label: string;
  status: "completed" | "current" | "upcoming";
  description?: string;
}

interface TimelineProps {
  steps: TimelineStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

function Timeline({ steps, orientation = "horizontal", className }: TimelineProps) {
  if (orientation === "vertical") {
    return (
      <div className={cn("space-y-0", className)}>
        {steps.map((step, i) => (
          <div key={step.id} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                step.status === "completed" && "bg-success/10 border-success text-success",
                step.status === "current" && "bg-brand/10 border-brand text-brand",
                step.status === "upcoming" && "bg-surface-hover border-border text-text-tertiary"
              )}>
                {step.status === "completed" ? (
                  <CheckCircle2 size={16} />
                ) : step.status === "current" ? (
                  <Circle size={16} className="fill-current" />
                ) : (
                  <Circle size={16} />
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  "w-0.5 flex-1 my-1",
                  step.status === "completed" ? "bg-success/30" : "bg-border"
                )} />
              )}
            </div>
            <div className="pb-6">
              <p className={cn(
                "text-sm font-medium",
                step.status === "current" ? "text-text-primary" : "text-text-secondary"
              )}>
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-text-tertiary mt-0.5">{step.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
              step.status === "completed" && "bg-success/10 text-success",
              step.status === "current" && "bg-brand/10 text-brand ring-2 ring-brand/20",
              step.status === "upcoming" && "bg-surface-hover text-text-tertiary"
            )}>
              {step.status === "completed" ? (
                <CheckCircle2 size={14} />
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span className={cn(
              "text-xs font-medium whitespace-nowrap",
              step.status === "current" ? "text-text-primary" : "text-text-tertiary"
            )}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight size={14} className="mx-2 text-text-tertiary/30 shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export { Timeline };
export type { TimelineStep };
