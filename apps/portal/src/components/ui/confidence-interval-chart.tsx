"use client";

import { cn } from "@/lib/utils";

interface CIPoint {
  label: string;
  mean: number;
  lower: number;
  upper: number;
}

interface ConfidenceIntervalChartProps {
  data: CIPoint[];
  title?: string;
  className?: string;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  confidence?: number;
}

export function ConfidenceIntervalChart({
  data,
  title,
  className,
  height = 250,
  xLabel,
  yLabel,
  confidence = 95,
}: ConfidenceIntervalChartProps) {
  if (data.length === 0) return null;

  const allValues = data.flatMap((d) => [d.lower, d.upper, d.mean]);
  const minVal = Math.min(...allValues) * 0.9;
  const maxVal = Math.max(...allValues) * 1.1;
  const range = maxVal - minVal || 1;

  const svgWidth = 500;
  const svgHeight = height;
  const pad = { top: 20, right: 20, bottom: 50, left: 50 };
  const chartW = svgWidth - pad.left - pad.right;
  const chartH = svgHeight - pad.top - pad.bottom;

  const xScale = (i: number) => pad.left + (i / (data.length - 1 || 1)) * chartW;
  const yScale = (v: number) => pad.top + chartH - ((v - minVal) / range) * chartH;

  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minVal + (range * i) / ticks);

  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      )}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                y1={yScale(tick)}
                x2={svgWidth - pad.right}
                y2={yScale(tick)}
                stroke="#2A2A2A"
                strokeDasharray="3 3"
              />
              <text
                x={pad.left - 8}
                y={yScale(tick) + 4}
                textAnchor="end"
                fill="#5C5C5C"
                fontSize={10}
              >
                {tick.toFixed(2)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = xScale(i);
            const yMean = yScale(d.mean);
            const yLow = yScale(d.lower);
            const yHigh = yScale(d.upper);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={yLow}
                  x2={x}
                  y2={yHigh}
                  stroke="#FF5A0A"
                  strokeWidth={2}
                  strokeOpacity={0.6}
                />
                <line
                  x1={x - 4}
                  y1={yLow}
                  x2={x + 4}
                  y2={yLow}
                  stroke="#FF5A0A"
                  strokeWidth={2}
                  strokeOpacity={0.6}
                />
                <line
                  x1={x - 4}
                  y1={yHigh}
                  x2={x + 4}
                  y2={yHigh}
                  stroke="#FF5A0A"
                  strokeWidth={2}
                  strokeOpacity={0.6}
                />
                <circle cx={x} cy={yMean} r={4} fill="#FF5A0A" />
                <text
                  x={x}
                  y={yMean - 10}
                  textAnchor="middle"
                  fill="#F0F0F0"
                  fontSize={9}
                  fontWeight={500}
                >
                  {d.mean.toFixed(3)}
                </text>
                <text
                  x={x}
                  y={svgHeight - pad.bottom + 16}
                  textAnchor="middle"
                  fill="#8B8B8B"
                  fontSize={10}
                >
                  {d.label}
                </text>
              </g>
            );
          })}

          <text
            x={svgWidth / 2}
            y={svgHeight - 5}
            textAnchor="middle"
            fill="#5C5C5C"
            fontSize={11}
          >
            {xLabel || ""}
          </text>
        </svg>
      </div>
      <p className="mt-2 text-center text-[10px] text-text-tertiary">
        {confidence}% confidence intervals
        {yLabel && ` · ${yLabel}`}
      </p>
    </div>
  );
}
