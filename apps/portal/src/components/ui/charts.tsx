"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  ScatterChart as RechartsScatterChart,
  Scatter,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "#FF5A0A",
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
];

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (value: number) => string;
}

function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      {label && (
        <p className="mb-1 text-xs font-medium text-text-primary">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="font-medium text-text-primary">
            {formatter ? formatter(entry.value) : entry.value.toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface BaseChartProps {
  className?: string;
  height?: number;
  title?: string;
}

interface BarChartProps extends BaseChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: { key: string; color?: string; name?: string }[];
  horizontal?: boolean;
  formatter?: (value: number) => string;
}

export function ChartBar({
  data,
  xKey,
  yKeys,
  horizontal,
  height = 300,
  className,
  title,
  formatter,
}: BarChartProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
          {horizontal ? (
            <XAxis type="number" tick={{ fill: "#8B8B8B", fontSize: 11 }} />
          ) : (
            <XAxis
              dataKey={xKey}
              tick={{ fill: "#8B8B8B", fontSize: 11 }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={60}
            />
          )}
          <YAxis tick={{ fill: "#8B8B8B", fontSize: 11 }} />
          <Tooltip content={<ChartTooltip formatter={formatter} />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#8B8B8B" }}
          />
          {yKeys.map((yk, i) => (
            <Bar
              key={yk.key}
              dataKey={yk.key}
              name={yk.name || yk.key}
              fill={yk.color || CHART_COLORS[i % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface LineChartProps extends BaseChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: { key: string; color?: string; name?: string; dashed?: boolean }[];
  formatter?: (value: number) => string;
}

export function ChartLine({
  data,
  xKey,
  yKeys,
  height = 300,
  className,
  title,
  formatter,
}: LineChartProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
          <XAxis dataKey={xKey} tick={{ fill: "#8B8B8B", fontSize: 11 }} />
          <YAxis tick={{ fill: "#8B8B8B", fontSize: 11 }} />
          <Tooltip content={<ChartTooltip formatter={formatter} />} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8B8B8B" }} />
          {yKeys.map((yk, i) => (
            <Line
              key={yk.key}
              type="monotone"
              dataKey={yk.key}
              name={yk.name || yk.key}
              stroke={yk.color || CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              strokeDasharray={yk.dashed ? "5 5" : undefined}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AreaChartProps extends BaseChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: { key: string; color?: string; name?: string }[];
  stacked?: boolean;
  formatter?: (value: number) => string;
}

export function ChartArea({
  data,
  xKey,
  yKeys,
  stacked,
  height = 300,
  className,
  title,
  formatter,
}: AreaChartProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
          <XAxis dataKey={xKey} tick={{ fill: "#8B8B8B", fontSize: 11 }} />
          <YAxis tick={{ fill: "#8B8B8B", fontSize: 11 }} />
          <Tooltip content={<ChartTooltip formatter={formatter} />} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8B8B8B" }} />
          {yKeys.map((yk, i) => (
            <Area
              key={yk.key}
              type="monotone"
              dataKey={yk.key}
              name={yk.name || yk.key}
              stroke={yk.color || CHART_COLORS[i % CHART_COLORS.length]}
              fill={yk.color || CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.15}
              stackId={stacked ? "1" : undefined}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ScatterChartProps extends BaseChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  zKey?: string;
  colorKey?: string;
  xLabel?: string;
  yLabel?: string;
  formatter?: (value: number) => string;
}

export function ChartScatter({
  data,
  xKey,
  yKey,
  colorKey,
  xLabel,
  yLabel,
  height = 300,
  className,
  title,
  formatter,
}: ScatterChartProps) {
  const colored = data.map((d, i) => ({
    ...d,
    fill: colorKey
      ? CHART_COLORS[i % CHART_COLORS.length]
      : "#FF5A0A",
  }));

  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
          <XAxis
            type="number"
            dataKey={xKey}
            name={xLabel || xKey}
            tick={{ fill: "#8B8B8B", fontSize: 11 }}
            label={xLabel ? { value: xLabel, position: "bottom", fill: "#8B8B8B", fontSize: 11 } : undefined}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            name={yLabel || yKey}
            tick={{ fill: "#8B8B8B", fontSize: 11 }}
            label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fill: "#8B8B8B", fontSize: 11 } : undefined}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
                  <p className="text-xs font-medium text-text-primary">{d.name || d.id || ""}</p>
                  <p className="text-xs text-text-secondary">
                    {xLabel || xKey}: {formatter ? formatter(d[xKey] as number) : d[xKey]}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {yLabel || yKey}: {formatter ? formatter(d[yKey] as number) : d[yKey]}
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={colored} fill="#FF5A0A">
            {colored.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Scatter>
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RadarChartProps extends BaseChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  keys: { key: string; color?: string; name?: string }[];
}

export function ChartRadar({
  data,
  dataKey,
  keys,
  height = 300,
  className,
  title,
}: RadarChartProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data}>
          <PolarGrid stroke="#2A2A2A" />
          <PolarAngleAxis dataKey={dataKey} tick={{ fill: "#8B8B8B", fontSize: 11 }} />
          <PolarRadiusAxis tick={{ fill: "#8B8B8B", fontSize: 10 }} />
          {keys.map((k, i) => (
            <Radar
              key={k.key}
              name={k.name || k.key}
              dataKey={k.key}
              stroke={k.color || CHART_COLORS[i % CHART_COLORS.length]}
              fill={k.color || CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.15}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, color: "#8B8B8B" }} />
          <Tooltip content={<ChartTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { CHART_COLORS };
