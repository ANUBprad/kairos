# Kairos Architecture

## Overview

Kairos is an Adaptive Knowledge Retrieval Intelligence Platform built around the idea that:

> Different queries require different retrieval strategies.

Instead of applying a fixed retrieval pipeline to every query, Kairos dynamically selects retrieval strategies based on query complexity and retrieval requirements.

---

# High-Level Architecture

```text
Client
  │
  ▼
Go API Gateway
  │
  ▼
gRPC Layer
  │
  ▼
Python Intelligence Layer
  │
  ├── Query Classification
  ├── Retrieval Planning
  ├── Retrieval Execution
  ├── Caching
  └── Response Assembly
  │
  ▼
LLM
  │
  ▼
Response
```

---

# Repository Structure

```text
kairos/
│
├── gateway/
├── intelligence/
├── proto/
├── sdk/
├── benchmarks/
├── docker/
├── docs/
│
├── docker-compose.yml
├── prometheus.yml
└── README.md
```

---

# Component Responsibilities

## gateway/

Responsibilities:

* API routing
* Request validation
* Authentication
* Rate limiting
* gRPC communication

Technology:

* Go

Purpose:

Acts as the public-facing entry point for Kairos.

---

## intelligence/

Responsibilities:

* Query classification
* Retrieval planning
* Retrieval execution
* Cache management
* Response generation

Technology:

* Python

Purpose:

Core intelligence engine of Kairos.

---

## proto/

Responsibilities:

* gRPC contracts
* Service definitions
* Request/response schemas

Purpose:

Communication layer between Gateway and Intelligence services.

---

## sdk/

Responsibilities:

* Developer API
* Client abstractions
* Integration helpers

Purpose:

Allows developers to integrate Kairos into applications.

---

## benchmarks/

Responsibilities:

* Evaluation datasets
* Benchmark definitions
* Experiment results

Purpose:

Provides reproducible evaluation for retrieval systems.

---

# Retrieval Pipeline

Current Pipeline:

```text
Query
 ↓
Classifier
 ↓
Strategy Selector
 ↓
Retriever
 ↓
LLM
 ↓
Response
```

---

# Future Kairos v2 Pipeline

```text
Query
 ↓
Classifier
 ↓
Confidence Score
 ↓
Retrieval Planner
 ↓
Budget Allocator
 ↓
Fallback Manager
 ↓
Retriever
 ↓
LLM
 ↓
Response
```

---

# Query Classification

Current Categories

* Simple
* Complex
* Multi-Hop

Purpose

Determine retrieval complexity before execution.

---

# Retrieval Planner (Phase 1)

Responsibilities:

* Select retrieval strategy
* Allocate retrieval budget
* Handle uncertainty
* Manage fallback logic

Inputs:

* Query
* Classification
* Confidence
* Metadata

Outputs:

* Retrieval strategy
* top_k
* Retrieval depth
* Budget
* Fallback policy

---

# Caching Layer

Purpose:

Reduce latency and cost by reusing previous retrieval results.

Future Metrics:

* Cache hit rate
* Cache miss rate
* Latency savings

---

# Evaluation Framework

Purpose:

Measure improvements objectively.

Metrics:

* Classification Accuracy
* Retrieval Recall
* Context Recall
* Context Precision
* Latency
* Cost
* Faithfulness
* Failure Rate

---

# Observability

Current Stack

* Prometheus
* Grafana

Tracked Metrics

* Request latency
* Throughput
* Retrieval performance
* Service health

Future Metrics

* Planner accuracy
* Retrieval quality
* Cost efficiency
* Hallucination rate

---

# Research Hypothesis

Kairos is built around a central hypothesis:

> Confidence-aware adaptive retrieval planning can improve retrieval quality while maintaining or reducing latency and retrieval cost compared to static retrieval routing.

Phase 1 is focused entirely on validating this hypothesis.

---

# Long-Term Vision

Kairos evolves from:

```text
Adaptive RAG Infrastructure
```

to:

```text
Intelligent Retrieval Operating System
```

capable of planning, executing, evaluating, and optimizing retrieval workflows automatically.
