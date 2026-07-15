const counters = new Map<string, number>();
const histograms = new Map<string, number[]>();

const MAX_HISTOGRAM_SAMPLES = 1000;

export function incrementCounter(name: string, value = 1) {
  counters.set(name, (counters.get(name) ?? 0) + value);
}

export function observeHistogram(name: string, value: number) {
  const samples = histograms.get(name) ?? [];
  samples.push(value);
  if (samples.length > MAX_HISTOGRAM_SAMPLES) samples.shift();
  histograms.set(name, samples);
}

export function getMetrics() {
  const countersObj: Record<string, number> = {};
  counters.forEach((v, k) => {
    countersObj[k] = v;
  });

  const histogramsObj: Record<string, { p50: number; p95: number; p99: number; count: number }> = {};
  histograms.forEach((samples, k) => {
    const sorted = [...samples].sort((a, b) => a - b);
    const len = sorted.length;
    histogramsObj[k] = {
      p50: len > 0 ? sorted[Math.floor(len * 0.5)] : 0,
      p95: len > 0 ? sorted[Math.floor(len * 0.95)] : 0,
      p99: len > 0 ? sorted[Math.floor(len * 0.99)] : 0,
      count: len,
    };
  });

  return {
    counters: countersObj,
    histograms: histogramsObj,
  };
}
