# Simple RAG Example

Demonstrates basic retrieval-augmented generation using Kairos.

## Usage

```bash
cd examples/simple_rag
pip install -r requirements.txt
python run.py
```

## What it demonstrates

- Loading documents into a vector store
- Simple query retrieval (direct vector search)
- LLM response generation with context

## Expected output

```
Query: What is the capital of France?
Answer: The capital of France is Paris.
Context sources: [doc1, doc3]
Latency: 145ms
```
