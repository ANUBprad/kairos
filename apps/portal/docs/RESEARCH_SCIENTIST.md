# Research Scientist Module

The Research Scientist module transforms raw benchmark results into research-quality conclusions. Instead of showing tables and graphs, it generates evidence-backed findings, identifies limitations, recommends next experiments, and produces publication-style research summaries.

## Architecture

```
src/lib/research-scientist/
├── types.ts                  # All type definitions
├── evidence.ts               # Evidence engine - generates evidence from benchmark data
├── findings.ts               # Finds patterns, tradeoffs, anomalies, comparisons
├── discussion.ts             # Explains why results happened
├── threats.ts                # Threats to validity generator
├── future-work.ts            # Suggests next experiments
├── executive-summary.ts      # Generates executive summary
├── abstract.ts               # Generates abstract and conclusion
├── recommendations.ts        # Evidence-backed recommendations
├── confidence.ts             # Research confidence score
└── index.ts                  # Main orchestrator

src/components/app/
└── research-scientist.tsx     # Client component (7 tabs)
```

## Core Concepts

### Evidence

Every generated statement must contain evidence. No unsupported claims.

```typescript
interface Evidence {
  metric: string;              // "Recall@K"
  configs: string[];           // ["Hybrid", "Vector"]
  pValue: number;              // 0.012
  confidenceInterval: [number, number];  // [0.05, 0.18]
  effectSize: number;          // 0.72
  effectMagnitude: "large";    // "negligible" | "small" | "medium" | "large"
  benchmarkIds: string[];      // ["run-1", "run-2"]
  reasoning: string;           // "Hybrid retrieval consistently retrieves more relevant documents."
  improvement: number;         // 0.114
  improvementPct: number;      // 11.4
}
```

### Finding

A structured research finding with evidence and interpretation.

```typescript
interface Finding {
  id: string;
  title: string;
  statement: string;           // Research-quality statement
  evidence: Evidence[];        // Supporting evidence
  confidence: number;          // 0-1
  interpretation: string;      // Practical interpretation
  severity: "critical" | "high" | "medium" | "low";
  category: "performance" | "tradeoff" | "pattern" | "anomaly" | "comparison";
}
```

### Research Paper

The complete output of the Research Scientist.

```typescript
interface ResearchPaper {
  abstract: string;
  executiveSummary: ExecutiveSummary;
  findings: Finding[];
  discussion: DiscussionPoint[];
  threats: Threat[];
  futureWork: FutureWorkItem[];
  conclusion: string;
  markdown: string;
  json: string;
}
```

## Algorithms

### 1. Evidence Engine (`evidence.ts`)

**Purpose:** Generate evidence from benchmark data with statistical rigor.

**Method:** For each pair of configurations and each metric:
1. Extract per-query metric values
2. Run `compareMetrics()` from RI-1 (paired t-test or Wilcoxon)
3. Compute bootstrap confidence interval
4. Compute effect size (Cohen's d)
5. Package into `Evidence` object

**Complexity:** O(C² × M × N) where C = configurations, M = metrics, N = questions

### 2. Findings Generator (`findings.ts`)

**Purpose:** Discover research findings from benchmark data.

**Findings types:**
- **Performance:** Best configuration for each metric with statistical significance
- **Tradeoff:** Correlation analysis between competing metrics (recall vs precision)
- **Pattern:** High-variability metrics (sensitive to configuration changes)
- **Anomaly:** Outlier configurations (z-score > 2)
- **Comparison:** Significant gaps between best and worst configurations

**Algorithms:**
- Pearson correlation for tradeoff detection
- Coefficient of variation for pattern analysis
- Z-score for anomaly detection

### 3. Discussion Generator (`discussion.ts`)

**Purpose:** Explain why results happened.

**Discussion points:**
- Why different configurations optimize different metrics
- Why metrics move together (correlation)
- Why tradeoffs appear
- Which configurations are functionally equivalent
- Unexpected observations

**Method:** Rule-based analysis of metric relationships and configuration similarities.

### 4. Threats to Validity (`threats.ts`)

**Purpose:** Automatically identify threats to the validity of conclusions.

**Categories:**
- **Internal:** Sample size, configuration coverage
- **External:** Single dataset, domain specificity
- **Construct:** Missing metrics (generation quality)
- **Conclusion:** Low statistical power

**Method:** Rule-based analysis of dataset size, metric coverage, and statistical power.

### 5. Future Work (`future-work.ts`)

**Purpose:** Suggest next experiments based on missing evidence.

**Suggestions:**
- Missing experiments (reranking, query expansion, multi-query)
- Performance improvements (larger top-K, latency optimization)
- Extensions (semantic chunking, LLM-as-judge)

**Method:** Gap analysis between current experiments and comprehensive evaluation.

### 6. Executive Summary (`executive-summary.ts`)

**Purpose:** Generate a concise executive summary.

**Components:**
- Overall conclusion
- Best configuration
- Confidence level
- Most important finding
- Most surprising observation
- Recommended deployment
- Next experiment

### 7. Confidence Score (`confidence.ts`)

**Purpose:** Compute a single confidence score for the research.

**Formula:**
```
confidence = Σ(factor_i × weight_i)
```

**Factors and weights:**
| Factor | Weight | Description |
|--------|--------|-------------|
| Benchmark count | 0.15 | Number of configurations tested |
| Statistical significance | 0.25 | Ratio of significant comparisons |
| Confidence intervals | 0.15 | Width of CIs (narrower = better) |
| Effect sizes | 0.15 | Ratio of large/moderate effects |
| Reproducibility | 0.10 | Per-query data availability |
| Metric consistency | 0.10 | Tradeoffs and anomalies |
| Experiment coverage | 0.10 | Threats to validity |

## Integration

### With RI-1 (Statistical Engine)

The evidence engine uses `compareMetrics()` from `significance.ts` for all statistical tests. This ensures:
- Proper test selection (paired t-test vs Wilcoxon)
- Correct p-value computation
- Bootstrap confidence intervals
- Effect size calculation

### With RI-2 (Research Intelligence)

The findings generator complements RI-2's pattern discovery:
- RI-2 focuses on automated pattern detection
- RI-4 focuses on research-quality conclusions with evidence
- Both use the same benchmark data

### With RI-3 (Debugger)

The evidence browser can link to debugger traces:
- Each evidence entry includes benchmark IDs
- Traces can be inspected for detailed analysis
- Why-not-retrieved analysis supports findings

## Usage

### In the Research Dashboard

The research page automatically computes the Research Scientist output:

```typescript
// In page.tsx
const researchScientistResult = generateResearchPaper({
  runs: benchmarkRuns,
  datasetName: "...",
  totalQuestions: 100,
});
```

### In Reports

The Research Scientist output can be included in reports:

```typescript
const { paper } = generateResearchPaper(input);
// paper.markdown contains the full research report
// paper.json contains structured data
```

## Limitations

1. **Requires benchmark data:** Cannot generate conclusions without runs
2. **Statistical minimum:** Needs at least 2 runs for comparison
3. **Rule-based discussion:** May miss subtle patterns
4. **No causal inference:** Correlations are not causation
5. **Single dataset focus:** Cross-dataset analysis requires multiple datasets
6. **No real-time updates:** Generated at page load, not live
7. **Text-based evidence:** No visualization of evidence in this version

## Extending the Module

### Adding a new finding type

1. Add a generator function in `findings.ts`
2. Call it in `generateFindings()`
3. The finding will automatically appear in the UI

### Adding a new threat category

1. Add a generator function in `threats.ts`
2. Call it in `generateThreats()`
3. The threat will appear in the Threats tab

### Adding a new discussion point

1. Add a generator function in `discussion.ts`
2. Call it in `generateDiscussion()`
3. The point will appear in the Discussion tab
