# Experiment Planner Module

The Experiment Planner module transforms Kairos from an analysis tool into an AI research assistant. It recommends the next best experiments based on configuration coverage, expected information gain, and cost-quality tradeoffs.

## Architecture

```
src/lib/experiment-planner/
├── types.ts                    # All type definitions
├── config-space.ts             # Configuration space analyzer
├── coverage.ts                 # Coverage calculator
├── uncertainty.ts              # Uncertainty estimator
├── pareto.ts                   # Pareto frontier generator
├── information-gain.ts         # Information gain estimator
├── prioritizer.ts              # Experiment prioritizer
├── cost-quality.ts             # Cost-quality planner
└── index.ts                    # Main exports

src/app/app/planner/
├── page.tsx                    # Server component
└── planner-client.tsx          # Client component
```

## Core Concepts

### Configuration Space

The set of all possible experiment configurations defined by dimensions.

```typescript
interface ConfigurationDimension {
  name: string;                 // "retrievalMode"
  type: "categorical" | "numeric" | "boolean";
  values: (string | number | boolean)[];  // ["vector", "hybrid", "bm25"]
  defaultValue: string | number | boolean;
  description: string;
}

interface ConfigurationSpace {
  dimensions: ConfigurationDimension[];
  totalCombinations: number;    // Product of all dimension sizes
}
```

**Default Dimensions:**
- retrievalMode: vector, hybrid, bm25, keyword
- chunkSize: 256, 512, 1024, 2048
- chunkOverlap: 0, 50, 100, 200
- topK: 3, 5, 10, 15, 20
- embeddingModel: ada-002, 3-small, 3-large
- reranker: none, cross-encoder, cohere-rerank
- temperature: 0.0, 0.3, 0.5, 0.7, 1.0
- useHybridWeight: true, false

**Total combinations:** 4 × 4 × 4 × 5 × 3 × 3 × 5 × 2 = 14,400

### Coverage Analysis

Measures how much of the configuration space has been explored.

```typescript
interface CoverageAnalysis {
  totalCombinations: number;
  exploredCombinations: number;
  coverageScore: number;        // explored / total
  dimensionCoverage: Array<{
    dimension: string;
    exploredValues: number;
    totalValues: number;
    coverage: number;
  }>;
  unexploredCombinations: Array<Record<string, string | number | boolean>>;
}
```

### Uncertainty Estimation

Predicts performance for untested configurations using k-nearest neighbors.

```typescript
interface UncertaintyEstimate {
  config: Record<string, string | number | boolean>;
  metric: string;
  predictedValue: number;
  uncertainty: number;          // Standard deviation of predictions
  confidenceInterval: [number, number];
  nearbyExperiments: number;
  distanceToNearest: number;
}
```

### Pareto Frontier

Identifies non-dominated solutions for multi-objective optimization.

```typescript
interface ParetoFrontier {
  points: ParetoPoint[];
  frontierPoints: ParetoPoint[];  // Non-dominated points
  dimensions: string[];           // Objectives
  dominatedCount: number;
  frontierCount: number;
}
```

**Pareto Dominance:** Point A dominates B if:
- A is at least as good as B in all objectives
- A is strictly better in at least one objective

### Information Gain

Estimates the value of running a specific experiment.

```typescript
interface InformationGainEstimate {
  config: Record<string, string | number | boolean>;
  expectedGain: number;         // 0-1
  gainType: "exploration" | "exploitation" | "uncertainty_reduction";
  reasoning: string;
  affectedMetrics: string[];
}
```

**Three Types:**
1. **Exploration:** Testing untested values or regions
2. **Exploitation:** Building on promising trends
3. **Uncertainty Reduction:** Sampling under-explored areas

### Experiment Prioritization

Ranks experiments by expected improvement, confidence, and information gain.

```typescript
interface ExperimentRecommendation {
  id: string;
  rank: number;
  config: Record<string, string | number | boolean>;
  expectedImprovement: number;
  confidence: number;
  statisticalBasis: string;
  expectedInformationGain: number;
  estimatedCost: ExperimentCostEstimate;
  priority: "high" | "medium" | "low";
  rationale: string;
  affectedMetrics: string[];
  paretoOptimal: boolean;
}
```

### Cost-Quality Planning

Optimizes experiment queue under budget constraints.

```typescript
interface ExperimentQueue {
  recommendations: ExperimentRecommendation[];
  totalEstimatedCost: number;
  totalEstimatedTimeMs: number;
  expectedOverallImprovement: number;
}
```

## Algorithms

### 1. Configuration Space Analyzer (`config-space.ts`)

**Purpose:** Define and analyze the configuration space.

**Method:**
1. Define default dimensions with values
2. Extend with observed dimensions from experiments
3. Compute total combinations (Cartesian product)
4. Generate all combinations for exhaustive search
5. Compute distances between configurations

**Distance Metric:**
- Numeric: Normalized Euclidean distance
- Categorical: Hamming distance (0 if same, 1 if different)
- Combined: Root mean square of individual distances

### 2. Coverage Calculator (`coverage.ts`)

**Purpose:** Measure exploration progress.

**Method:**
1. Generate all possible combinations
2. Identify explored combinations from experiment history
3. Compute coverage score (explored / total)
4. Analyze per-dimension coverage
5. Identify coverage gaps (missing values, sparse regions)

**Gap Detection:**
- Missing value: Dimension coverage < 50%
- Sparse region: Large gaps in numeric ranges
- Unexplored cluster: Overall coverage < 10%

### 3. Uncertainty Estimator (`uncertainty.ts`)

**Purpose:** Predict performance for untested configurations.

**Method (k-NN Regression):**
1. Find k nearest neighbors (k=5 default)
2. Compute distance-weighted average
3. Calculate prediction variance
4. Construct confidence interval (95% CI)

**Formula:**
```
predicted = Σ(weight_i × value_i) / Σ(weight_i)
uncertainty = sqrt(Σ(weight_i × (value_i - predicted)²) / Σ(weight_i))
weight = 1 / (1 + distance)
```

### 4. Pareto Frontier Generator (`pareto.ts`)

**Purpose:** Find non-dominated solutions.

**Method (Pairwise Dominance):**
1. For each pair of points (A, B):
   - Check if A dominates B (at least as good in all, strictly better in one)
   - Check if B dominates A
2. Points with no dominators are on the frontier
3. Assign ranks based on dominance relationships
4. Find knee point (maximum distance from diagonal)

**Hypervolume Computation:**
- 2D: Analytical computation
- Higher dimensions: Monte Carlo approximation (1000 samples)

### 5. Information Gain Estimator (`information-gain.ts`)

**Purpose:** Estimate value of running an experiment.

**Method:**
1. **Exploration Gain:** Distance to nearest neighbor + novelty of values
2. **Exploitation Gain:** Interpolated performance from neighbors
3. **Uncertainty Reduction:** Current prediction uncertainty

**Formula:**
```
exploration = min(1, distance_to_nearest × 0.7 + novelty_bonus × 0.3)
exploitation = weighted_average(neighbor_performances)
uncertainty_reduction = average_neighbor_distance
```

### 6. Experiment Prioritizer (`prioritizer.ts`)

**Purpose:** Rank experiments by expected value.

**Method:**
1. For each candidate configuration:
   - Estimate expected improvement
   - Compute information gain
   - Estimate cost (latency, tokens)
   - Check Pareto optimality
   - Compute confidence score
2. Combine scores:
   ```
   score = improvement × 0.4 + confidence × 0.3 + info_gain × 0.2 + pareto_bonus × 0.1
   ```
3. Sort by score, return top-k

### 7. Cost-Quality Planner (`cost-quality.ts`)

**Purpose:** Optimize experiment queue under budget.

**Method:**
1. Compute efficiency score for each experiment:
   ```
   efficiency = improvement × 0.25 + confidence × 0.2 + info_gain × 0.2 + cost_efficiency × 0.35
   ```
2. Sort by efficiency
3. Greedily select experiments within budget
4. Return optimized queue

## Integration

### With RI-1 (Statistical Engine)

The prioritizer uses statistical concepts:
- Confidence intervals for uncertainty
- Effect sizes for expected improvement
- Significance tests for validation

### With RI-2 (Research Intelligence)

Planner complements intelligence:
- RI-2 identifies patterns in completed experiments
- RI-6 recommends future experiments to test those patterns
- Together they form a complete research loop

### With RI-4 (Research Scientist)

Planner extends research conclusions:
- RI-4 generates findings and discussion
- RI-6 recommends experiments to address threats and gaps
- Together they ensure continuous improvement

### With RI-5 (Reproducibility)

Planner uses provenance data:
- Configuration history from provenance chains
- Cost data from experiment metadata
- Results from reproducible manifests

## Usage

### Analyzing Configuration Space

```typescript
import { analyzeConfigurationSpace, calculateCoverage } from "@/lib/experiment-planner";

const space = analyzeConfigurationSpace(runs);
console.log(space.totalCombinations); // 14400

const coverage = calculateCoverage(space, runs);
console.log(coverage.coverageScore); // 0.05 (5% explored)
```

### Generating Recommendations

```typescript
import { prioritizeExperiments } from "@/lib/experiment-planner";

const recommendations = prioritizeExperiments({
  candidates: unexploredConfigs,
  runs: experimentHistory,
  dimensions: space.dimensions,
  metrics: ["avgRecallAtK", "avgMRR"],
  objectives: ["avgRecallAtK", "avgMRR"],
  budgetMs: 3600000, // 1 hour
});

console.log(recommendations[0].rationale);
// "Explores untested values: retrievalMode=hybrid, chunkSize=1024"
```

### Planning Cost-Optimal Queue

```typescript
import { planCostQuality, estimateTotalCost } from "@/lib/experiment-planner";

const queue = planCostQuality({
  recommendations,
  budgetMs: 7200000, // 2 hours
  maxExperiments: 10,
});

const cost = estimateTotalCost(queue);
console.log(cost.totalLatencyFormatted); // "45m 23s"
```

## Limitations

1. **Approximate predictions:** k-NN regression is not a perfect model
2. **No causal inference:** Correlations are not causation
3. **Fixed dimensions:** Default dimensions may not match all use cases
4. **No transfer learning:** Cannot leverage external knowledge
5. **Greedy optimization:** Queue optimization is greedy, not global
6. **No adversarial testing:** Does not recommend stress tests
7. **Static budget:** Cannot adapt budget dynamically

## Extending the Module

### Adding a new dimension

1. Add to `DEFAULT_DIMENSIONS` in `config-space.ts`
2. The space analyzer will automatically include it

### Adding a new metric

1. Add to `METRICS` array in the planner client
2. The prioritizer will consider it in recommendations

### Adding a new objective

1. Pass additional objectives to `prioritizeExperiments()`
2. The Pareto frontier will include it
