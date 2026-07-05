export interface DescriptiveStats {
  n: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  variance: number;
  stdDev: number;
  ci95Lower: number;
  ci95Upper: number;
  sum: number;
}

export function calculateDescriptiveStats(values: number[]): DescriptiveStats {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, median: 0, min: 0, max: 0, variance: 0, stdDev: 0, ci95Lower: 0, ci95Upper: 0, sum: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((s, v) => s + v, 0);
  const mean = sum / n;

  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  const tValue = getTValue(n - 1);
  const stdErr = stdDev / Math.sqrt(n);
  const margin = tValue * stdErr;

  return {
    n,
    mean: round(mean),
    median: round(median),
    min: round(sorted[0]),
    max: round(sorted[n - 1]),
    variance: round(variance),
    stdDev: round(stdDev),
    ci95Lower: round(mean - margin),
    ci95Upper: round(mean + margin),
    sum: round(sum),
  };
}

function getTValue(df: number): number {
  const tTable: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021,
    50: 2.009, 60: 2.000, 80: 1.990, 100: 1.984, 120: 1.980,
  };
  if (df <= 0) return 1.96;
  if (df >= 120) return 1.96;
  const keys = Object.keys(tTable).map(Number).sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (df >= keys[i]) return tTable[keys[i]];
  }
  return 1.96;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
