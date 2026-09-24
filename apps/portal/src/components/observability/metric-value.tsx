// Honest telemetry metric: a number that was never collected renders as
// "Not yet collected" instead of a fabricated zero. Used by every
// Observability summary card.
interface MetricValueProps {
  value: number | null | undefined;
  format?: (value: number) => string;
  className?: string;
}

export function MetricValue({ value, format, className }: MetricValueProps) {
  if (typeof value !== "number") {
    return <span className={className}>Not yet collected</span>;
  }
  return <span className={className}>{format ? format(value) : value.toLocaleString()}</span>;
}