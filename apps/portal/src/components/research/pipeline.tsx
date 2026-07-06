"use client";

import { ArrowRight } from "lucide-react";
import { getIcon } from "./icon-registry";

export interface PipelineStage {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface PipelineProps {
  stages: PipelineStage[];
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { icon: 14, dot: "w-7 h-7", text: "text-[10px]" },
  md: { icon: 16, dot: "w-9 h-9", text: "text-[11px]" },
  lg: { icon: 20, dot: "w-11 h-11", text: "text-xs" },
};

export function Pipeline({ stages, className = "", size = "md" }: PipelineProps) {
  const s = sizeMap[size];
  return (
    <div className={`flex items-center justify-center flex-wrap gap-0 sm:gap-1 ${className}`}>
      {stages.map((stage, i) => {
        const Icon = getIcon(stage.icon);
        return (
          <div key={stage.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5 px-1.5 sm:px-2 py-2 rounded-lg">
              <div className={`${s.dot} rounded-full flex items-center justify-center text-white ${stage.color}`}>
                <Icon size={s.icon} />
              </div>
              <span className={`${s.text} font-medium text-text-secondary whitespace-nowrap`}>
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight size={size === "sm" ? 12 : 14} className="text-text-tertiary/30 mx-0.5 sm:mx-1 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
