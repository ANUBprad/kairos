# Research Intelligence Engine

The Research Intelligence Engine automatically analyzes benchmark results to discover patterns, detect trends, infer root causes, and generate structured research findings. It transforms raw benchmark data into actionable insights.

## Architecture

```
research-intelligence.ts
├── Pattern Discovery
│   ├── Correlation Analysis (Pearson r)
│   ├── Tradeoff Detection (Recall-Precision)
│   ├── Configuration Patterns (CV analysis)
│   └── Anomaly Detection (Z-score)
├── Trend Detection
│   └── Linear Regression (slope, R²)
├── Root Cause Inference
│   └── Rule-based metric analysis
├── Finding Generator
│   └── Structured findings with evidence
└── Experiment Advisor
    └── Configuration space analysis
```

## Core Concepts

### Finding

Each finding is a structured insight with:

- **id**: Unique identifier (e.g., `corr-recallAtK-precisionAtK`)
- **type**: Category: `correlation`, `tradeoff`, `trend`, `pattern`, `anomaly`, `insight`
- **severity**: Impact level: `critical`, `high`, `medium`, `low`
- **title**: Human-readable title
- **observation**: What was observed
- **metrics**: Which metrics are involved
- **evidence**: Supporting data points
- **interpretation**: What it means for the user
- **confidence**: 0-1 score indicating reliability

### IntelligenceResult

The complete output of the analysis:

```typescript
{
  findings: ResearchFinding[];           // All discovered findings
  trends: TrendAnalysis[];              // Temporal metric trends
  rootCauses: RootCause[];              // Inferred causes of issues
  experimentSuggestions: ExperimentSuggestion[];  // Recommended next experiments
  metricSummary: Record<string, { mean, std, min, max }>;  // Per-metric statistics
}
```

## Algorithms

### 1. Correlation Analysis

**Purpose:** Discover which metrics move together across configurations.

**Method:** Pearson correlation coefficient (r) between metric pairs.

**Formula:**
```
r = Σ((xi - x̄)(yi - ȳ)) / √(Σ(xi - x̄)² × Σ(yi - ȳ)²)
```

**Interpretation:**
- |r| ≥ 0.9: Strong correlation → finding generated
- |r| ≥ 0.7: Moderate correlation → finding generated
- |r| < 0.7: Weak/no correlation → ignored

**Why Pearson:** Measures linear relationships. For non-linear relationships, consider Spearman (not currently implemented).

**Data source:** Aggregated metrics across benchmark runs (e.g., if you have 10 runs, each with avgRecallAtK and avgPrecisionAtK, we compute r across those 10 pairs).

### 2. Tradeoff Detection

**Purpose:** Identify when optimizing one metric degrades another.

**Method:** Correlation analysis between Recall and Precision specifically.

**Why Recall-Precision:** This is the fundamental tradeoff in information retrieval. High recall (retrieve all relevant docs) usually means retrieving many docs, which lowers precision (fraction of retrieved docs that are relevant).

**Threshold:** r < -0.5 triggers a tradeoff finding.

### 3. Configuration Pattern Analysis

**Purpose:** Identify which metrics are sensitive to configuration changes.

**Method:** Coefficient of Variation (CV = std/mean) across configurations.

**Interpretation:**
- CV > 20%: High variability → metric is configuration-sensitive
- CV < 5%: Low variability → metric is robust

**Why CV:** Normalizes variance by the mean, allowing comparison across metrics with different scales.

### 4. Anomaly Detection

**Purpose:** Find configurations with unusual performance characteristics.

**Method:** Z-score analysis (how many standard deviations from the mean).

**Threshold:** |z| > 2 triggers an anomaly finding.

**Why Z-score:** Simple, interpretable, works well for small datasets. For larger datasets, more sophisticated methods (IQR, DBSCAN) could be used.

### 5. Trend Detection

**Purpose:** Track how metrics change over time (across sequential runs).

**Method:** Simple linear regression (least squares).

**Formulas:**
```
slope = Σ((xi - x̄)(yi - ȳ)) / Σ(xi - x̄)²
R² = 1 - SS_res / SS_tot
```

**Interpretation:**
- slope > 0.01 and R² > 0.3: Improving trend
- slope < -0.01 and R² > 0.3: Declining trend
- R² < 0.3 with high CV: Volatile metric

**Why linear regression:** Simple, interpretable trend lines. Assumes linear trends; non-linear trends (e.g., exponential decay) are not captured.

### 6. Root Cause Inference

**Purpose:** Diagnose why certain metrics are underperforming.

**Method:** Rule-based analysis using metric thresholds and relationships.

**Rules:**
1. If avgRecall < 0.5: Check top-K, embedding model, chunking
2. If avgPrecision < 0.3: Check top-K, KB quality, embedding discriminability
3. If high recall but low nDCG: Check ranking quality, suggest reranking
4. If avgLatency > 2000ms: Check top-K, embedding model, chunk count

**Why rules:** More interpretable than ML-based approaches. Works with small datasets. Can be extended with domain-specific rules.

### 7. Experiment Suggestions

**Purpose:** Recommend next experiments based on current findings.

**Method:** Heuristic analysis of findings and metric summary.

**Priority assignment:**
- Tradeoff findings → high priority (resolve bottlenecks)
- Low recall → high priority (fundamental issue)
- High latency → medium priority (performance issue)
- Few experiments → medium priority (need more data)

## Usage

### In the Research Dashboard

The research page (`/app/research`) automatically computes intelligence on the server side:

```typescript
// In page.tsx (server component)
const intelligenceResult = analyzeResearchIntelligence(runs);
```

Results are passed to the client component which renders:
- Key Findings (with severity badges)
- Trends (direction + R²)
- Root Causes (with recommendations)
- Recommended Experiments (with priority)

### In Reports

The report generator accepts an optional `intelligenceResult` parameter:

```typescript
import { generateFullReport } from "./report-generator";
import { analyzeResearchIntelligence } from "./research-intelligence";

const intelligence = analyzeResearchIntelligence(runs);
const report = generateFullReport(config, dataset, results, intelligence);
```

This adds three new sections to reports:
1. **Research Findings** - Automated pattern analysis
2. **Discussion** - Enhanced with trends and root causes
3. **Threats to Validity** - Sample size, generalizability concerns
4. **Future Work** - Includes recommended experiments

### In Recommendations

The evidence-backed recommendation engine (`generateEvidenceBackedRecommendations`) provides structured recommendations with:
- Metrics and confidence intervals
- Statistical significance tests
- Plain-text explanations

## Limitations

1. **Minimum data:** Requires at least 3 runs for trend detection, 2 runs for correlations
2. **Linear assumptions:** Trend detection assumes linear trends
3. **Pearson correlation:** Only captures linear relationships
4. **Rule-based root causes:** May miss novel patterns
5. **No causal inference:** Correlations are not causation
6. **Small sample effects:** Statistical tests have low power with few runs
7. **Metric focus:** Only analyzes IR metrics, not answer quality

## Extending the Engine

### Adding a new pattern detector

1. Add a function that takes `perQueryData` and `runs`
2. Return `ResearchFinding[]`
3. Call it in `analyzeResearchIntelligence()`

### Adding a new root cause rule

1. Add a condition in `inferRootCauses()`
2. Include evidence and recommendation
3. The finding will automatically appear in the UI

### Adding a new experiment suggestion

1. Add a condition in `suggestExperiments()`
2. Include rationale and expected impact
3. The suggestion will appear in reports and dashboard
