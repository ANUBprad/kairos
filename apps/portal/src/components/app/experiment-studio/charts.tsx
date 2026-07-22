"use client";

import { cn } from "@/lib/utils";

interface RadarChartProps {
  data: { metric: string; value: number; maxValue?: number }[];
  size?: number;
  className?: string;
}

export function RadarChart({ data, size = 200, className }: RadarChartProps) {
  const center = size / 2;
  const radius = (size / 2) - 30;
  const angleStep = (2 * Math.PI) / data.length;
  const levels = 5;

  const getPoint = (index: number, value: number) => {
    const maxVal = data[index].maxValue ?? 1;
    const r = (value / maxVal) * radius;
    const angle = index * angleStep - Math.PI / 2;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const polygonPoints = data.map((d, i) => {
    const p = getPoint(i, d.value);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("text-text-tertiary", className)} role="img" aria-label="Radar chart">
      {Array.from({ length: levels }, (_, level) => {
        const r = ((level + 1) / levels) * radius;
        const points = data.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
        }).join(" ");
        return <polygon key={level} points={points} fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />;
      })}
      {data.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="currentColor" strokeWidth="0.5" opacity="0.2" />;
      })}
      <polygon points={polygonPoints} fill="var(--color-brand)" fillOpacity="0.15" stroke="var(--color-brand)" strokeWidth="2" />
      {data.map((d, i) => {
        const p = getPoint(i, d.value);
        return <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--color-brand)" />;
      })}
      {data.map((d, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const labelR = radius + 18;
        const x = center + labelR * Math.cos(angle);
        const y = center + labelR * Math.sin(angle);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-text-secondary text-[10px] font-medium">
            {d.metric}
          </text>
        );
      })}
    </svg>
  );
}

interface BarChartProps {
  data: { label: string; values: { key: string; value: number; color?: string }[] }[];
  height?: number;
  className?: string;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

export function GroupedBarChart({ data, height = 200, className, showValues = true, formatValue = (v) => v.toFixed(2) }: BarChartProps) {
  if (data.length === 0) return null;

  const allKeys = [...new Set(data.flatMap((d) => d.values.map((v) => v.key)))];
  const maxValue = Math.max(...data.flatMap((d) => d.values.map((v) => v.value)), 1);
  const barGroupWidth = 100 / data.length;
  const barWidth = (barGroupWidth * 0.7) / allKeys.length;
  const gap = barGroupWidth * 0.3 / 2;

  const defaultColors = ["var(--color-brand)", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className={cn("w-full", className)}>
      <svg width="100%" height={height + 30} viewBox={`0 0 100 ${height + 30}`} preserveAspectRatio="none" role="img" aria-label="Bar chart">
        {Array.from({ length: 5 }, (_, i) => {
          const y = height - (i / 4) * height;
          return <line key={i} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeWidth="0.2" opacity="0.15" />;
        })}
        {data.map((group, gi) => {
          const groupX = gi * barGroupWidth + gap;
          return (
            <g key={gi}>
              {group.values.map((v, vi) => {
                const barH = (v.value / maxValue) * height;
                const x = groupX + vi * barWidth;
                return (
                  <g key={vi}>
                    <rect x={x} y={height - barH} width={barWidth * 0.85} height={barH} fill={v.color || defaultColors[vi % defaultColors.length]} rx="0.5" opacity="0.85" />
                    {showValues && (
                      <text x={x + barWidth * 0.425} y={height - barH - 1} textAnchor="middle" className="fill-text-tertiary" fontSize="1.8">
                        {formatValue(v.value)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={gi * barGroupWidth + barGroupWidth / 2} y={height + 6} textAnchor="middle" className="fill-text-secondary" fontSize="2.2">
                {group.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface TrendChartProps {
  data: { timestamp: string; value: number; label?: string }[];
  height?: number;
  color?: string;
  className?: string;
  showDots?: boolean;
  formatValue?: (value: number) => string;
}

export function TrendChart({ data, height = 120, color = "var(--color-brand)", className, showDots = true, formatValue = (v) => v.toFixed(2) }: TrendChartProps) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values) * 0.9;
  const maxVal = Math.max(...values) * 1.1 || 1;
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((d.value - minVal) / range) * height,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L 100 ${height} L 0 ${height} Z`;

  return (
    <div className={cn("w-full", className)}>
      <svg width="100%" height={height + 20} viewBox={`0 0 100 ${height + 20}`} preserveAspectRatio="none" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={`gradient-${color.replace(/[^a-z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#gradient-${color.replace(/[^a-z0-9]/g, "")})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
        {showDots && points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2" fill={color} />
            {data[i].label && (
              <text x={p.x} y={height + 10} textAnchor="middle" className="fill-text-tertiary" fontSize="1.8">
                {data[i].label}
              </text>
            )}
          </g>
        ))}
        {points.length > 0 && (
          <>
            <text x="0" y={points[0].y - 4} className="fill-text-tertiary" fontSize="1.8">{formatValue(values[0])}</text>
            <text x="100" y={points[points.length - 1].y - 4} textAnchor="end" className="fill-text-tertiary" fontSize="1.8">{formatValue(values[values.length - 1])}</text>
          </>
        )}
      </svg>
    </div>
  );
}

interface HeatmapProps {
  rows: string[];
  columns: string[];
  cells: (number | null)[][];
  maxValue?: number;
  className?: string;
  formatValue?: (value: number) => string;
}

export function Heatmap({ rows, columns, cells, maxValue: maxProp, className, formatValue = (v) => v.toFixed(2) }: HeatmapProps) {
  const allValues = cells.flat().filter((v): v is number => v !== null);
  const maxValue = maxProp ?? Math.max(...allValues, 1);

  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (intensity >= 0.8) return "bg-success/30 text-success";
    if (intensity >= 0.6) return "bg-brand/20 text-brand";
    if (intensity >= 0.4) return "bg-warning/20 text-warning";
    if (intensity >= 0.2) return "bg-info/10 text-info";
    return "bg-bg text-text-tertiary";
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-xs" role="grid" aria-label="Heatmap">
        <thead>
          <tr>
            <th className="p-2 text-left text-text-tertiary font-medium" scope="col"></th>
            {columns.map((col) => (
              <th key={col} className="p-2 text-center text-text-tertiary font-medium" scope="col">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row}>
              <td className="p-2 text-text-secondary font-medium whitespace-nowrap" scope="row">{row}</td>
              {columns.map((_, ci) => {
                const value = cells[ri]?.[ci];
                return (
                  <td key={ci} className="p-1">
                    {value !== null && value !== undefined ? (
                      <div className={cn("rounded-md p-2 text-center font-medium", getColor(value))} title={`${rows[ri]} × ${columns[ci]}: ${formatValue(value)}`}>
                        {formatValue(value)}
                      </div>
                    ) : (
                      <div className="rounded-md p-2 text-center text-text-tertiary bg-bg/50">—</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
