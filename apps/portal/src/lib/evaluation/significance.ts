export interface SignificanceResult {
  testUsed: string;
  statistic: number;
  pValue: number;
  significant: boolean;
  alpha: number;
  sampleSize: number;
}

export interface EffectSizeResult {
  value: number;
  magnitude: "negligible" | "small" | "medium" | "large";
  method: string;
}

export interface BootstrapResult {
  meanDifference: number;
  ciLower: number;
  ciUpper: number;
  nResamples: number;
}

export interface ComparisonResult {
  metricName: string;
  labelA: string;
  labelB: string;
  meanA: number;
  meanB: number;
  meanDifference: number;
  significance: SignificanceResult;
  effectSize: EffectSizeResult;
  bootstrapCI: BootstrapResult;
  interpretation: string;
}

interface TestSelectionCriteria {
  useParametric: boolean;
  reason: string;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr: number[], ddof = 1): number {
  const n = arr.length;
  if (n <= ddof) return 0;
  const m = mean(arr);
  const sumSq = arr.reduce((s, v) => s + (v - m) ** 2, 0);
  return sumSq / (n - ddof);
}

function stdDev(arr: number[], ddof = 1): number {
  return Math.sqrt(variance(arr, ddof));
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 0) {
    return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  }
  return sorted[Math.floor(n / 2)];
}

function absSort(arr: number[]): number[] {
  return [...arr].sort((a, b) => Math.abs(a) - Math.abs(b));
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const xAbs = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * xAbs);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-xAbs * xAbs);
  return 0.5 * (1 + sign * y);
}

function tCDF(t: number, df: number): number {
  if (df <= 0) return normalCDF(t);
  if (df === 1) return 0.5 + Math.atan(t) / Math.PI;
  if (df === 2) return 0.5 + t / (2 * Math.sqrt(2 + t * t));
  if (df >= 30) return normalCDF(t);
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const bt = betaInc(a, b, x);
  if (t >= 0) {
    return 1 - 0.5 * bt;
  }
  return 0.5 * bt;
}

function betaInc(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return 0;
  if (x === 0 || x === 1) return x;

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);

  if (x < (a + 1) / (a + b + 2)) {
    return front * betaCF(a, b, x) / a;
  }
  return 1 - front * betaCF(b, a, 1 - x) / b;
}

function betaCF(a: number, b: number, x: number): number {
  const maxIter = 200;
  const eps = 3e-12;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function lnGamma(x: number): number {
  const cof = [
    76.18009172947, -86.505320329416, 24.014098240830,
    -1.23173957245, 0.001208650973866, -0.000005395239385,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.00000000019001;
  for (let j = 0; j < 6; j++) {
    ser += cof[j] / ++y;
  }
  return -tmp + Math.log(2.506628274631 * ser / x);
}

function tPValue(t: number, df: number): number {
  const p = 2 * (1 - tCDF(Math.abs(t), df));
  return Math.min(1, Math.max(0, p));
}

function wilcoxonPValue(w: number, n: number): number {
  const mu = n * (n + 1) / 4;
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
  if (sigma === 0) return 1;
  const z = (w - mu) / sigma;
  return 2 * (1 - normalCDF(Math.abs(z)));
}

function checkNormality(diffs: number[]): boolean {
  if (diffs.length < 8) return false;
  const sorted = [...diffs].sort((a, b) => a - b);
  const n = sorted.length;
  const m = median(sorted);
  const q1 = median(sorted.slice(0, Math.floor(n / 2)));
  const q3 = median(sorted.slice(Math.ceil(n / 2)));
  const iqr = q3 - q1;
  if (iqr === 0) return true;
  const skewness = diffs.reduce((s, v) => s + ((v - m) / (iqr || 1)) ** 3, 0) / n;
  return Math.abs(skewness) < 2;
}

function selectTest(baseline: number[], treatment: number[]): TestSelectionCriteria {
  const diffs = treatment.map((t, i) => t - baseline[i]);
  const normal = checkNormality(diffs);
  if (normal) {
    return { useParametric: true, reason: "Differences appear normally distributed; using paired t-test." };
  }
  return { useParametric: false, reason: "Differences do not appear normally distributed; using Wilcoxon signed-rank test." };
}

function pairedTTest(baseline: number[], treatment: number[], alpha: number): SignificanceResult {
  const diffs = treatment.map((t, i) => t - baseline[i]);
  const n = diffs.length;
  const d = mean(diffs);
  const s = stdDev(diffs);
  if (s === 0) {
    return { testUsed: "Paired t-test", statistic: 0, pValue: 1, significant: false, alpha, sampleSize: n };
  }
  const se = s / Math.sqrt(n);
  const t = d / se;
  const p = tPValue(t, n - 1);
  return {
    testUsed: "Paired t-test",
    statistic: Math.round(t * 10000) / 10000,
    pValue: Math.round(p * 10000) / 10000,
    significant: p < alpha,
    alpha,
    sampleSize: n,
  };
}

function wilcoxonSignedRankTest(baseline: number[], treatment: number[], alpha: number): SignificanceResult {
  const diffs = treatment.map((t, i) => t - baseline[i]);
  const nonZero = diffs.filter((d) => Math.abs(d) > 1e-12);
  const n = nonZero.length;
  if (n === 0) {
    return { testUsed: "Wilcoxon signed-rank", statistic: 0, pValue: 1, significant: false, alpha, sampleSize: diffs.length };
  }
  const absDiffs = absSort(nonZero);
  const ranks = new Array(absDiffs.length);
  let i = 0;
  while (i < absDiffs.length) {
    let j = i;
    while (j < absDiffs.length && Math.abs(absDiffs[j] - absDiffs[i]) < 1e-12) j++;
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }
  let wPlus = 0;
  let wMinus = 0;
  const originalOrder = nonZero.map((d) => ({ diff: d, absDiff: Math.abs(d) }));
  originalOrder.sort((a, b) => a.absDiff - b.absDiff);
  let rankIdx = 0;
  for (const item of originalOrder) {
    let j = rankIdx;
    while (j < originalOrder.length && Math.abs(originalOrder[j].absDiff - item.absDiff) < 1e-12) j++;
    const avgRank = (rankIdx + j + 1) / 2;
    if (item.diff > 0) wPlus += avgRank;
    else wMinus += avgRank;
    rankIdx = j;
  }
  const w = Math.min(wPlus, wMinus);
  const p = wilcoxonPValue(w, n);
  return {
    testUsed: "Wilcoxon signed-rank",
    statistic: Math.round(w * 10000) / 10000,
    pValue: Math.round(p * 10000) / 10000,
    significant: p < alpha,
    alpha,
    sampleSize: diffs.length,
  };
}

function bootstrapMeanDifference(
  baseline: number[],
  treatment: number[],
  nResamples: number,
): BootstrapResult {
  const diffs = treatment.map((t, i) => t - baseline[i]);
  const meanDiff = mean(diffs);
  const n = diffs.length;
  const resampled: number[] = [];

  for (let r = 0; r < nResamples; r++) {
    const sample: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * n);
      sample.push(diffs[idx]);
    }
    resampled.push(mean(sample));
  }
  resampled.sort((a, b) => a - b);
  const ciLower = resampled[Math.floor(nResamples * 0.025)];
  const ciUpper = resampled[Math.floor(nResamples * 0.975)];

  return {
    meanDifference: Math.round(meanDiff * 10000) / 10000,
    ciLower: Math.round(ciLower * 10000) / 10000,
    ciUpper: Math.round(ciUpper * 10000) / 10000,
    nResamples,
  };
}

function cohensD(baseline: number[], treatment: number[]): EffectSizeResult {
  const meanA = mean(baseline);
  const meanB = mean(treatment);
  const varA = variance(baseline);
  const varB = variance(treatment);
  const n1 = baseline.length;
  const n2 = treatment.length;
  const pooledVar = ((n1 - 1) * varA + (n2 - 1) * varB) / (n1 + n2 - 2);
  if (pooledVar <= 1e-15) {
    return { value: 0, magnitude: "negligible", method: "Cohen's d" };
  }
  const d = (meanB - meanA) / Math.sqrt(pooledVar);
  const absD = Math.abs(d);
  let magnitude: EffectSizeResult["magnitude"];
  if (absD < 0.2) magnitude = "negligible";
  else if (absD < 0.5) magnitude = "small";
  else if (absD < 0.8) magnitude = "medium";
  else magnitude = "large";
  return { value: Math.round(d * 10000) / 10000, magnitude, method: "Cohen's d" };
}

function cliffsDelta(baseline: number[], treatment: number[]): EffectSizeResult {
  let countGreater = 0;
  let countLess = 0;
  for (const b of treatment) {
    for (const a of baseline) {
      if (b > a) countGreater++;
      else if (b < a) countLess++;
    }
  }
  const total = baseline.length * treatment.length;
  if (total === 0) {
    return { value: 0, magnitude: "negligible", method: "Cliff's delta" };
  }
  const delta = (countGreater - countLess) / total;
  const absDelta = Math.abs(delta);
  let magnitude: EffectSizeResult["magnitude"];
  if (absDelta < 0.147) magnitude = "negligible";
  else if (absDelta < 0.33) magnitude = "small";
  else if (absDelta < 0.474) magnitude = "medium";
  else magnitude = "large";
  return { value: Math.round(delta * 10000) / 10000, magnitude, method: "Cliff's delta" };
}

function computeEffectSize(baseline: number[], treatment: number[]): EffectSizeResult {
  const normal = checkNormality(treatment.map((t, i) => t - baseline[i]));
  if (normal) {
    return cohensD(baseline, treatment);
  }
  return cliffsDelta(baseline, treatment);
}

function interpretResult(
  metricName: string,
  significance: SignificanceResult,
  effectSize: EffectSizeResult,
  bootstrapCI: BootstrapResult,
  meanA: number,
  meanB: number,
): string {
  const diff = meanB - meanA;
  const direction = diff > 0 ? "improvement" : diff < 0 ? "degradation" : "no change";
  const effectDesc = effectSize.magnitude === "negligible"
    ? "The effect size is negligible"
    : effectSize.magnitude === "small"
    ? "The effect size is small"
    : effectSize.magnitude === "medium"
    ? "The effect size is medium"
    : "The effect size is large";

  if (significance.significant) {
    return `Statistically significant ${direction} in ${metricName} (p=${significance.pValue.toFixed(4)}, ${effectDesc}). The 95% CI for the mean difference is [${bootstrapCI.ciLower.toFixed(4)}, ${bootstrapCI.ciUpper.toFixed(4)}].`;
  }
  return `The observed ${direction} in ${metricName} is NOT statistically significant (p=${significance.pValue.toFixed(4)}, ${effectDesc}). This improvement was observed but is not statistically significant.`;
}

export function compareMetrics(
  baselineValues: number[],
  treatmentValues: number[],
  metricName: string,
  labelA: string,
  labelB: string,
  alpha = 0.05,
): ComparisonResult {
  if (baselineValues.length < 2 || treatmentValues.length < 2) {
    throw new Error("Need at least 2 paired observations for statistical comparison.");
  }
  if (baselineValues.length !== treatmentValues.length) {
    throw new Error("Baseline and treatment must have the same number of observations.");
  }

  const criteria = selectTest(baselineValues, treatmentValues);
  const significance = criteria.useParametric
    ? pairedTTest(baselineValues, treatmentValues, alpha)
    : wilcoxonSignedRankTest(baselineValues, treatmentValues, alpha);

  const effectSize = computeEffectSize(baselineValues, treatmentValues);
  const bootstrapCI = bootstrapMeanDifference(baselineValues, treatmentValues, 10000);

  const meanA = mean(baselineValues);
  const meanB = mean(treatmentValues);

  const interpretation = interpretResult(metricName, significance, effectSize, bootstrapCI, meanA, meanB);

  return {
    metricName,
    labelA,
    labelB,
    meanA: Math.round(meanA * 10000) / 10000,
    meanB: Math.round(meanB * 10000) / 10000,
    meanDifference: Math.round((meanB - meanA) * 10000) / 10000,
    significance,
    effectSize,
    bootstrapCI,
    interpretation,
  };
}

export function compareAllMetrics(
  baselinePerQuery: Array<Record<string, number>>,
  treatmentPerQuery: Array<Record<string, number>>,
  metricKeys: string[],
  labelA: string,
  labelB: string,
  alpha = 0.05,
): ComparisonResult[] {
  if (baselinePerQuery.length !== treatmentPerQuery.length) {
    throw new Error("Baseline and treatment must have the same number of observations.");
  }

  return metricKeys.map((key) => {
    const baselineValues = baselinePerQuery.map((q) => q[key] ?? 0);
    const treatmentValues = treatmentPerQuery.map((q) => q[key] ?? 0);
    return compareMetrics(baselineValues, treatmentValues, key, labelA, labelB, alpha);
  });
}

export function groupEquivalentConfigurations(
  entries: Array<{ label: string; perQueryMetrics: Record<string, number[]> }>,
  metricKey: string,
  alpha = 0.05,
): Array<{ tier: number; labels: string[] }> {
  if (entries.length === 0) return [];
  if (entries.length === 1) return [{ tier: 1, labels: [entries[0].label] }];

  const sorted = [...entries].sort((a, b) => {
    const meanA = mean(a.perQueryMetrics[metricKey] ?? []);
    const meanB = mean(b.perQueryMetrics[metricKey] ?? []);
    return meanB - meanA;
  });

  const tiers: Array<{ tier: number; labels: string[] }> = [];
  let currentTier = 1;
  let currentGroup = [sorted[0].label];

  for (let i = 1; i < sorted.length; i++) {
    const baselineValues = sorted[i - 1].perQueryMetrics[metricKey] ?? [];
    const treatmentValues = sorted[i].perQueryMetrics[metricKey] ?? [];

    if (baselineValues.length < 2 || treatmentValues.length < 2 || baselineValues.length !== treatmentValues.length) {
      currentTier++;
      tiers.push({ tier: currentTier, labels: [...currentGroup] });
      currentGroup = [sorted[i].label];
      continue;
    }

    const result = compareMetrics(baselineValues, treatmentValues, metricKey, sorted[i - 1].label, sorted[i].label, alpha);

    if (!result.significance.significant) {
      currentGroup.push(sorted[i].label);
    } else {
      tiers.push({ tier: currentTier, labels: [...currentGroup] });
      currentTier++;
      currentGroup = [sorted[i].label];
    }
  }

  tiers.push({ tier: currentTier, labels: [...currentGroup] });
  return tiers;
}
