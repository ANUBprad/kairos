import React from "react";

interface DataPoint {
  label: string;
  value: number;
  maxValue?: number;
}

export function RadarChart({
  data,
  size = 300,
  levels = 5,
}: {
  data: DataPoint[];
  size?: number;
  levels?: number;
}) {
  if (data.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const angleStep = (Math.PI * 2) / data.length;
  const labelRadius = radius + 24;

  const getPoint = (index: number, value: number, r: number = radius) => {
    const angle = angleStep * index - Math.PI / 2;
    return {
      x: cx + r * value * Math.cos(angle),
      y: cy + r * value * Math.sin(angle),
    };
  };

  const gridPoints: React.ReactNode[] = [];
  for (let level = 1; level <= levels; level++) {
    const r = (radius / levels) * level;
    const points = data
      .map((_, i) => {
        const p = getPoint(i, 1, r);
        return `${p.x},${p.y}`;
      })
      .join(" ");
    gridPoints.push(
      <polygon key={`grid-${level}`} points={points} fill="none" stroke="hsl(var(--border))" strokeWidth={1} />,
    );
  }

  const axisLines = data.map((_, i) => {
    const p = getPoint(i, 1);
    return <line key={`axis-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="hsl(var(--border))" strokeWidth={1} />;
  });

  const dataPoints = data.map((d, i) => getPoint(i, d.value));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const labels = data.map((d, i) => {
    const p = getPoint(i, 1, labelRadius);
    return (
      <text
        key={`label-${i}`}
        x={p.x}
        y={p.y}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground"
        fontSize={11}
      >
        {d.label}
      </text>
    );
  });

  const dataCircles = dataPoints.map((p, i) => (
    <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3} className="fill-primary" />
  ));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {gridPoints}
      {axisLines}
      <polygon points={polygonPoints} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={2} />
      {dataCircles}
      {labels}
    </svg>
  );
}

export function BarChart({
  data,
  height = 250,
  maxBarWidth = 48,
  showValues = true,
}: {
  data: DataPoint[];
  height?: number;
  maxBarWidth?: number;
  showValues?: boolean;
}) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.maxValue ?? d.value), 0.01);
  const padding = { top: 20, right: 16, bottom: 60, left: 8 };
  const width = Math.max(data.length * (maxBarWidth + 12) + padding.left + padding.right, 300);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barWidth = Math.min(chartW / data.length - 8, maxBarWidth);

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue / yTicks) * i);

  return (
    <svg width={width} height={height} className="overflow-visible">
      {yTickValues.map((val) => {
        const y = padding.top + chartH - (val / maxValue) * chartH;
        return (
          <g key={`ytick-${val}`}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />
            <text x={padding.left - 6} y={y} textAnchor="end" dominantBaseline="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>
              {val.toFixed(2)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = (d.value / maxValue) * chartH;
        const x = padding.left + (chartW / data.length) * i + (chartW / data.length - barWidth) / 2;
        const y = padding.top + chartH - barH;
        return (
          <g key={`bar-${i}`}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, 1)} rx={3} className="fill-primary" fillOpacity={0.85} />
            {showValues && (
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={10}>
                {d.value.toFixed(3)}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontSize={10}
              transform={`rotate(-35, ${x + barWidth / 2}, ${height - 8})`}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  secondary,
  footer,
  higherIsBetter,
  icon: Icon,
}: {
  label: string;
  value: string;
  secondary?: string;
  footer?: string;
  higherIsBetter?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} className="text-muted-foreground" />}
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {secondary && <span className="text-sm text-muted-foreground">{secondary}</span>}
        {higherIsBetter !== undefined && (
          <span className={`text-xs ${higherIsBetter ? "text-emerald-500" : "text-amber-500"}`}>
            {higherIsBetter ? "↑ higher is better" : "↓ lower is better"}
          </span>
        )}
      </div>
      {footer && <div className="text-xs text-muted-foreground mt-1">{footer}</div>}
    </div>
  );
}
