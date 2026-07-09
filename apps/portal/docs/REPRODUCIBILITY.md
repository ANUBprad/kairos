# Reproducibility Module

The Reproducibility module transforms Kairos into a fully reproducible research workbench. Every experiment can be captured, shared, and recreated exactly.

## Architecture

```
src/lib/reproducibility/
├── types.ts                    # All type definitions
├── manifest.ts                 # Experiment manifest generation/import
├── config-diff.ts              # Configuration comparison engine
├── lineage.ts                  # Lineage graph builder
├── provenance.ts               # Provenance chain tracker
├── reproducibility-score.ts    # Reproducibility score calculator
├── citation.ts                 # Citation generator
└── index.ts                    # Main exports

src/app/app/lineage/
├── page.tsx                    # Server component
└── lineage-client.tsx          # Client component
```

## Core Concepts

### Experiment Manifest

A complete snapshot of an experiment configuration and results.

```typescript
interface ExperimentManifest {
  manifestVersion: string;      // "1.0.0"
  manifestId: string;           // Unique identifier
  experimentName: string;
  dataset: { id, name, source, questionCount, checksum };
  pipeline: {
    chunking: PipelineStage;
    embedding: PipelineStage;
    retrieval: PipelineStage;
    reranking: PipelineStage | null;
    prompt: PipelineStage;
    generation: PipelineStage;
    evaluation: PipelineStage;
  };
  config: Record<string, unknown>;
  results: ExperimentResults;
  metadata: { kairosVersion, environment, dependencies };
}
```

### Lineage Graph

A directed acyclic graph (DAG) showing the flow from dataset to research report.

```
Dataset → Chunking → Embedding → Retrieval → Reranking → Prompt → Generation → Evaluation → Report
```

Each node is clickable and shows:
- Parameters used
- Version information
- Dependencies
- Metrics (for evaluation nodes)

### Provenance Chain

An immutable chain of records tracking every action performed on the data.

```typescript
interface ProvenanceRecord {
  id: string;
  timestamp: string;
  action: "created" | "executed" | "evaluated" | "analyzed" | "exported";
  actor: string;
  inputs: string[];
  outputs: string[];
  parameters: Record<string, unknown>;
  checksum: string;              // Integrity verification
  parentProvenanceId: string | null;
}
```

### Configuration Diff

Compare any two experiments side-by-side.

**Highlights:**
- Changed parameters with before/after values
- Added/removed parameters
- Metric differences with direction and magnitude
- Statistical significance tests

### Reproducibility Score

A weighted score (0-100%) measuring how completely an experiment is documented.

| Factor | Weight | Description |
|--------|--------|-------------|
| Configuration Completeness | 20% | Pipeline stage parameters |
| Data Provenance | 15% | Dataset traceability |
| Environment Capture | 15% | Runtime environment |
| Dependency Lock | 15% | Version pinning |
| Result Determinism | 20% | Metric completeness |
| Documentation Quality | 15% | Name, description, tags |

### Citations

Automatic generation of citations in APA and BibTeX formats.

**Citation types:**
- Dataset citation
- Model citation (embedding, generation)
- Library citation (Kairos)
- Configuration citation
- Benchmark citation

## Algorithms

### 1. Manifest Generation (`manifest.ts`)

**Input:** Experiment configuration and results
**Output:** Complete manifest with pipeline stages, metadata, and checksums

**Method:**
1. Extract pipeline stages from configuration
2. Compute dataset checksum for integrity
3. Calculate statistical summaries from per-question metrics
4. Capture environment details (Node.js version, platform)
5. Generate unique manifest ID

### 2. Configuration Diff (`config-diff.ts`)

**Input:** Two experiment configurations
**Output:** Detailed comparison with statistical analysis

**Method:**
1. Flatten nested configuration objects
2. Categorize parameters by pipeline stage
3. Compute metric differences (absolute and relative)
4. Run statistical significance tests (z-test approximation)
5. Calculate effect sizes (Cohen's d)
6. Generate overall assessment (identical/minor/moderate/major/completely_different)

### 3. Lineage Graph Builder (`lineage.ts`)

**Input:** Experiment manifest
**Output:** DAG with nodes and edges

**Method:**
1. Create nodes for each pipeline stage
2. Connect nodes in pipeline order
3. Add report and manifest nodes
4. Identify root nodes (no incoming edges)
5. Identify leaf nodes (no outgoing edges)
6. Support graph export (DOT, Mermaid formats)

### 4. Provenance Engine (`provenance.ts`)

**Input:** Experiment manifest and actor
**Output:** Chain of provenance records

**Method:**
1. Create record for dataset creation
2. Create records for each pipeline execution step
3. Create records for evaluation, analysis, and export
4. Link records via parentProvenanceId
5. Compute checksums for integrity verification
6. Verify chain integrity

### 5. Reproducibility Score (`reproducibility-score.ts`)

**Input:** Manifest and optional provenance chain
**Output:** Weighted score with breakdown

**Method:**
1. Compute score for each factor (0-1)
2. Apply weights to factors
3. Calculate weighted average
4. Generate recommendations based on low scores
5. Return detailed breakdown with evidence

### 6. Citation Generator (`citation.ts`)

**Input:** Experiment manifest
**Output:** Citation collection with APA and BibTeX

**Method:**
1. Generate citations for each component (dataset, model, library)
2. Format in APA style
3. Generate BibTeX entries
4. Create citation collection with metadata

## Integration

### With RI-1 (Statistical Engine)

The configuration diff uses `compareMetrics()` from `significance.ts` for statistical tests. This ensures:
- Proper test selection
- Correct p-value computation
- Bootstrap confidence intervals

### With RI-2 (Research Intelligence)

Lineage graphs complement research intelligence:
- RI-2 identifies patterns across experiments
- RI-5 traces how those experiments were created
- Together they provide full context for findings

### With RI-3 (Debugger)

Provenance chains link to debugger traces:
- Each execution step has a provenance record
- Debugger traces show detailed execution
- Together they provide full transparency

### With RI-4 (Research Scientist)

Reproducibility enhances research conclusions:
- Every finding links to evidence with provenance
- Every recommendation can be traced to specific experiments
- Every conclusion has a reproducibility score

## Usage

### Generating a Manifest

```typescript
import { generateManifest, manifestToJSON } from "@/lib/reproducibility";

const manifest = generateManifest({
  experimentName: "Hybrid Retrieval Test",
  description: "Testing hybrid retrieval with different weights",
  author: "Researcher",
  tags: ["hybrid", "retrieval"],
  dataset: { id: "ds-1", name: "TechDocs", questionCount: 100 },
  config: { retrievalMode: "hybrid", vectorWeight: 0.7 },
  results: { aggregatedMetrics: { avgRecallAtK: 0.85 }, perQuestionMetrics: [] },
});

const json = manifestToJSON(manifest);
```

### Comparing Configurations

```typescript
import { computeConfigurationDiff } from "@/lib/reproducibility";

const diff = computeConfigurationDiff({
  configA: { id: "run-1", name: "Baseline", timestamp: "...", config: {...}, metrics: {...} },
  configB: { id: "run-2", name: "Improved", timestamp: "...", config: {...}, metrics: {...} },
});

console.log(diff.summary.overallAssessment); // "moderate"
console.log(diff.metricDifferences); // [{metric: "recall", direction: "improved", ...}]
```

### Building Lineage Graphs

```typescript
import { buildLineageGraph, lineageToMermaid } from "@/lib/reproducibility";

const graph = buildLineageGraph({ manifest });
const mermaid = lineageToMermaid(graph);
// Use mermaid in documentation or UI
```

### Computing Reproducibility Score

```typescript
import { computeReproducibilityScore } from "@/lib/reproducibility";

const score = computeReproducibilityScore({ manifest, provenanceChain });
console.log(score.overall); // 0.85
console.log(score.recommendations); // ["Add dependency versions..."]
```

## Limitations

1. **No remote storage:** Manifests are local, not synced to cloud
2. **No automatic versioning:** Manual manifest updates required
3. **No dependency resolution:** Cannot auto-install exact versions
4. **No environment virtualization:** Cannot guarantee identical runtime
5. **No dataset versioning:** Only checksum, not full snapshot
6. **Approximate statistics:** z-test approximation for diff analysis
7. **No cross-platform testing:** Only tested on current platform

## Extending the Module

### Adding a new provenance action

1. Add the action type to `ProvenanceAction` in `types.ts`
2. Create a record with `createProvenanceRecord()`
3. Add to the chain in `buildProvenanceChain()`

### Adding a new citation type

1. Add the type to `CitationType` in `types.ts`
2. Create a generator function in `citation.ts`
3. Call it in `generateCitations()`

### Adding a new reproducibility factor

1. Add a computation function in `reproducibility-score.ts`
2. Add to the factors array in `computeReproducibilityScore()`
3. Adjust weights accordingly
