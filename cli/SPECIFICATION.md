# Kairos CLI Specification

## Overview

The `kairos` CLI provides command-line access to the Kairos RAG evaluation platform. It enables programmatic experiment execution, dataset management, benchmark running, and report generation.

## Installation

```bash
npm install -g @kairos/cli
# or
npx @kairos/cli --help
```

## Authentication

```bash
kairos auth login          # Interactive login (opens browser)
kairos auth token          # Print current API token
kairos auth set-token <token>  # Set API token directly
```

Environment variable: `KAIROS_API_KEY` or `KAIROS_TOKEN`

## Global Options

```
--api-url <url>      API base URL (default: https://api.kairos.dev)
--project <id>       Project ID (or set KAIROS_PROJECT_ID)
--format <format>    Output format: json, table, csv (default: table)
--verbose            Enable verbose logging
--dry-run            Show what would happen without executing
```

## Commands

### Experiments

```bash
# List experiments
kairos experiments list [--status <status>] [--kb <kbId>] [--limit <n>]

# Create experiment
kairos experiments create \
  --name "Hybrid vs Vector" \
  --kb <kbId> \
  --dataset <datasetId> \
  --retriever vector \
  --llm gpt-4o-mini \
  --top-k 10

# Run experiment (single query)
kairos experiments run <experimentId> \
  --query "What is the capital of France?"

# Run experiment against dataset
kairos experiments run <experimentId> \
  --dataset <datasetId> \
  --parallel <n> \
  --delay <ms>

# Compare experiments
kairos experiments compare <expA> <expB> \
  --format table

# Export experiment report
kairos experiments export <experimentId> \
  --format json|markdown|csv \
  --output report.json

# Delete experiment
kairos experiments delete <experimentId>

# Archive/unarchive
kairos experiments archive <experimentId>
kairos experiments unarchive <experimentId>
```

### Datasets

```bash
# List datasets
kairos datasets list [--limit <n>]

# Create dataset
kairos datasets create \
  --name "Q&A Test Set" \
  --source "manual" \
  --tags "test,qa"

# Add questions to dataset
kairos datasets add-question <datasetId> \
  --question "What is RAG?" \
  --expected-answer "Retrieval-Augmented Generation" \
  --expected-context '["doc-1","doc-2"]'

# Import questions from JSONL
kairos datasets import <datasetId> \
  --file questions.jsonl \
  --format jsonl

# Export dataset
kairos datasets export <datasetId> \
  --format json|jsonl|csv \
  --output dataset.json

# Create new version
kairos datasets version create <datasetId> \
  --name "v2 with edge cases"

# Rollback to previous version
kairos datasets version rollback <datasetId>

# Show version history
kairos datasets versions <datasetId>
```

### Benchmarks

```bash
# Run benchmark
kairos benchmark run \
  --dataset <datasetId> \
  --config config.json \
  --output results.json

# Run with multiple strategies
kairos benchmark run \
  --dataset <datasetId> \
  --strategies vector,hybrid,multi-query \
  --llm gpt-4o-mini \
  --top-k 10

# Compare benchmark results
kairos benchmark compare \
  --run-a <runId> \
  --run-b <runId>

# Generate leaderboard
kairos benchmark leaderboard \
  --dataset <datasetId> \
  --metric recall@10
```

### Artifacts

```bash
# List artifacts for experiment
kairos artifacts list <experimentId>

# Download artifact
kairos artifacts download <artifactId> --output ./artifact.json

# Upload artifact
kairos artifacts upload <experimentId> \
  --type "report" \
  --name "results.json" \
  --file ./results.json

# Delete artifact
kairos artifacts delete <artifactId>
```

### Configuration

```bash
# Show current config
kairos config show

# Set config value
kairos config set <key> <value>

# Reset config
kairos config reset
```

## Configuration File

`.kairosrc` or `kairos.config.json`:

```json
{
  "apiUrl": "https://api.kairos.dev",
  "projectId": "proj_xxx",
  "defaultLlm": "gpt-4o-mini",
  "defaultEmbedding": "text-embedding-3-small",
  "defaultTopK": 10,
  "defaultRetriever": "hybrid"
}
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Kairos Benchmark
  uses: kairos-ai/cli-action@v1
  with:
    api-key: ${{ secrets.KAIROS_API_KEY }}
    command: benchmark run
    dataset-id: ${{ vars.KAIROS_DATASET_ID }}
    strategies: vector,hybrid
    output: results.json

- name: Comment PR with Results
  uses: actions/github-script@v7
  with:
    script: |
      const results = require('./results.json');
      // Post comparison as PR comment
```

### GitLab CI

```yaml
kairos-benchmark:
  stage: evaluate
  script:
    - npx @kairos/cli benchmark run --dataset $DATASET_ID --strategies vector,hybrid --output results.json
  artifacts:
    paths:
      - results.json
```

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Authentication error |
| 3 | Not found |
| 4 | Validation error |
| 5 | Rate limited |
| 6 | Network error |

## Output Formats

### Table (default)
```
ID                  NAME                  STATUS    RUNS    LAST RUN
exp_abc123          Hybrid vs Vector      draft     5       2h ago
exp_def456          BM25 vs Embedding     active    12      1h ago
```

### JSON
```json
{
  "experiments": [...],
  "total": 2,
  "limit": 50,
  "offset": 0
}
```

### CSV
```csv
id,name,status,runs,last_run
exp_abc123,Hybrid vs Vector,draft,5,2024-01-15T10:00:00Z
```
