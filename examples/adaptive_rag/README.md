# Adaptive RAG Example

Demonstrates Kairos' adaptive query routing — queries are classified and routed to the optimal retriever.

## Usage

```bash
cd examples/adaptive_rag
pip install -r requirements.txt
python run.py
```

## What it demonstrates

- Query classification (simple / complex / multi-hop)
- Adaptive strategy selection
- Confidence-based fallback handling

## Expected output

```
Query: What is Python?
  Classified as: simple
  Strategy: direct retrieval (top_k=3)
  Answer: Python is a high-level programming language...

Query: Explain the relationship between inflation and unemployment.
  Classified as: complex
  Strategy: diversity retrieval + rerank (top_k=5)
  Answer: According to the Phillips curve, inflation and unemployment...
```
