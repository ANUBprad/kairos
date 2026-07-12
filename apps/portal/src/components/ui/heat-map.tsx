"use client";

import { cn } from "@/lib/utils";

interface HeatMapProps {
  rows: string[];
  columns: string[];
  cells: (number | null)[][];
  title?: string;
  maxValue?: number;
  colorScale?: [string, string];
  className?: string;
  formatter?: (value: number) => string;
}

function getHeatColor(
  value: number,
  max: number,
  low: string,
  high: string
): string {
  const ratio = Math.min(value / max, 1);
  const r1 = parseInt(low.slice(1, 3), 16);
  const g1 = parseInt(low.slice(3, 5), 16);
  const b1 = parseInt(low.slice(5, 7), 16);
  const r2 = parseInt(high.slice(1, 3), 16);
  const g2 = parseInt(high.slice(3, 5), 16);
  const b2 = parseInt(high.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

export function HeatMap({
  rows,
  columns,
  cells,
  title,
  maxValue: maxOverride,
  colorScale = ["#14181D", "#FF5A0A"],
  className,
  formatter,
}: HeatMapProps) {
  const maxVal =
    maxOverride ??
    Math.max(
      ...cells.flat().filter((v): v is number => v !== null),
      1
    );

  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              {columns.map((col) => (
                <th
                  key={col}
                  className="p-1 text-center font-medium text-text-tertiary"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row}>
                <td className="p-1 text-right font-medium text-text-tertiary pr-2 whitespace-nowrap">
                  {row}
                </td>
                {columns.map((col, ci) => {
                  const val = cells[ri]?.[ci];
                  const bg =
                    val !== null && val !== undefined
                      ? getHeatColor(val, maxVal, colorScale[0], colorScale[1])
                      : "transparent";
                  return (
                    <td key={col} className="p-0.5">
                      <div
                        className="flex h-9 items-center justify-center rounded-md text-[10px] font-medium transition-transform hover:scale-110"
                        style={{
                          backgroundColor: bg,
                          color:
                            val !== null && val !== undefined
                              ? val / maxVal > 0.5
                                ? "#fff"
                                : "#8B8B8B"
                              : "#5C5C5C",
                        }}
                        title={`${row} × ${col}: ${
                          val !== null && val !== undefined
                            ? formatter
                              ? formatter(val)
                              : val.toFixed(4)
                            : "N/A"
                        }`}
                      >
                        {val !== null && val !== undefined
                          ? formatter
                            ? formatter(val)
                            : val.toFixed(3)
                          : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
