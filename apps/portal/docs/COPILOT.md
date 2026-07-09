# AI Research Copilot

## Overview

The AI Research Copilot (Phase RI-7) is an intelligent conversational assistant that provides evidence-backed answers about your RAG research. It acts as an orchestrator that combines insights from all other RI-1 through RI-6 subsystems to deliver contextually relevant, grounded responses.

## Architecture

### Core Principle: Orchestrator, Not Replacement

The Copilot does NOT replace any existing subsystem. Instead, it:
- Routes user intent to the appropriate subsystems
- Gathers context from all available data sources
- Selects and ranks evidence by relevance
- Grounds every claim in real benchmark data
- Provides confidence scores based on evidence quality

### Subsystems

#### 1. Intent Detection (`intent.ts`)
Classifies user queries into 12 intent categories:
- **explain**: Understand metrics, concepts, results
- **debug**: Investigate problems, low scores, anomalies
- **compare**: Side-by-side configuration comparisons
- **recommend**: Get suggestions for next experiments
- **plan**: Generate research plans with steps
- **optimize**: Find accuracy-latency trade-offs
- **interpret**: Make sense of statistical results
- **summarize**: Get overview of research progress
- **explore**: Discover available data and options
- **review**: Assess reproducibility and validity
- **validate**: Check statistical significance
- **learn**: Educational explanations with personal data

#### 2. Context Builder (`context-builder.ts`)
Gathers comprehensive context from:
- Knowledge base configuration
- Benchmark history and metrics
- Leaderboard rankings
- Statistical comparisons
- Experiment planner status
- Research scientist findings
- Reproducibility scores
- Memory constraints

#### 3. Evidence Selector (`evidence-selector.ts`)
Selects and ranks evidence by:
- Relevance to detected intent
- Recency of data
- Statistical significance
- Effect sizes
- Source reliability

#### 4. Confidence Calculator (`confidence.ts`)
Computes confidence based on 7 factors:
- Evidence quantity (20%)
- Statistical significance (25%)
- Effect sizes (15%)
- Reproducibility (15%)
- Experiment coverage (10%)
- Planner confidence (10%)
- Research confidence (5%)

#### 5. Grounding Engine (`grounding.ts`)
Ensures every claim is evidence-backed:
- Extracts claims from responses
- Verifies each claim against available evidence
- Generates citations for grounded claims
- Flags unsupported statements
- Produces grounding summary

#### 6. Memory Manager (`memory.ts`)
Persists user context in localStorage:
- Previous questions and intents
- Detected constraints (budget, metrics, timeframes)
- Preferences (preferred metric, retrieval mode)
- Session state

#### 7. Suggestions Engine (`suggestions.ts`)
Generates contextual suggestions:
- Intent-based suggestions
- Context-aware suggestions
- Proactive suggestions based on data gaps
- Follow-up suggestions

#### 8. Timeline Builder (`timeline.ts`)
Creates research event timeline:
- Benchmark completions
- Significant findings
- Configuration changes
- Milestones reached

#### 9. Response Builder (`response.ts`)
Formats structured responses:
- Answer text
- Evidence list with sources
- Confidence metrics
- Related experiments/benchmarks
- Suggested follow-ups

#### 10. Prompt Builder (`prompt-builder.ts`)
Constructs LLM prompts:
- System instructions per intent
- Context summary
- Evidence sections
- Formatting guidelines

#### 11. Concept Explainer (`explainer.ts`)
Provides personalized explanations:
- Maps concepts to user's data
- Generates examples from experiments
- Links to relevant documentation

#### 12. Advisor (`advisor.ts`)
Proactive research recommendations:
- Performance gap analysis
- Coverage gap detection
- Reproducibility issues
- Statistical problems
- Efficiency opportunities

#### 13. Planner (`planner.ts`)
Conversational experiment planning:
- Step-by-step research plans
- Budget and time adaptation
- Risk identification
- Success criteria definition

### Orchestration Flow

```
User Query
    ↓
Intent Detection
    ↓
Context Building (all subsystems)
    ↓
Evidence Selection (relevance-ranked)
    ↓
Response Generation (intent-specific)
    ↓
Grounding Verification
    ↓
Confidence Calculation
    ↓
Structured Response
```

## Usage

### Chat Interface
1. Navigate to **AI Copilot** in the sidebar
2. Type your question in the chat input
3. The Copilot analyzes your query and responds with:
   - Evidence-backed answer
   - Detected intent
   - Confidence score
   - Grounding status
   - Suggested follow-ups

### Example Queries
- "Explain my benchmark results"
- "Compare my last two configurations"
- "What should I experiment with next?"
- "Debug low recall scores"
- "How reproducible are my results?"
- "Show me the Pareto frontier"

### Evidence Panel
The right sidebar shows:
- Experiment summary
- Recent activity
- Evidence used for current response
- Quick actions

## API

### POST /api/copilot
```json
{
  "query": "string",
  "benchmarkRuns": [...]
}
```

Response:
```json
{
  "answer": "string",
  "intent": "string",
  "confidence": { "overall": 0.85 },
  "evidence": [...],
  "suggestedFollowUp": [...],
  "grounding": { "grounded": true, "citations": 3 }
}
```

## Integration with Other Phases

- **RI-1 (Statistical)**: Uses significance tests for evidence grounding
- **RI-2 (Intelligence)**: Leverages patterns and trends for recommendations
- **RI-3 (Debugger)**: Provides debugging context and traces
- **RI-4 (Scientist)**: References findings, threats, recommendations
- **RI-5 (Reproducibility)**: Checks reproducibility scores
- **RI-6 (Planner)**: Uses coverage and Pareto data for planning

## Memory Constraints

The Copilot remembers:
- `preferredMetric`: User's focus metric
- `preferredBudgetMs`: Time budget per experiment
- `maxExperimentsPerDay`: Daily experiment limit
- `timeframeDays`: Planning horizon
- `preferredRetrievalMode`: Retrieval strategy preference
