"""Seed the evaluation namespace with a small deterministic corpus.

The Evaluate job starts ChromaDB and Ollama but ships no knowledge base, so
the namespace it evaluates against does not exist and every entry fails with
``Unable to find the namespace``. Ingesting a fixture document first lets the
run exercise the real path: chunk -> embed -> upsert -> retrieve -> generate.

It is a fixture, not the benchmark's corpus: the golden queries target the
EU AI Act, which this repository does not carry, so the job proves the
pipeline executes end to end rather than scoring retrieval quality.

Usage:
    python scripts/seed_eval_corpus.py --namespace ci-eval
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

CORPUS = """\
Kairos evaluation smoke corpus.

Kairos is a self-hosted retrieval-augmented generation workbench. A Go
gateway forwards requests over gRPC to a Python intelligence service, which
handles document ingestion, embedding, retrieval from ChromaDB, query
classification, and response generation.

Retrieval is namespaced: each ChromaDB collection is one namespace, and every
request selects its namespace explicitly. Simple queries use hybrid BM25 plus
vector search, multi-hop queries decompose into sub-questions, and complex
queries apply MMR diversity with cross-encoder reranking.

Generation runs against the configured LLM provider. In CI that provider is
Ollama, reached through the OpenAI-compatible routes it serves under /v1.

This document exists so the evaluation job has a non-empty namespace to read
from; the queries themselves come from the benchmark dataset.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--namespace", required=True, help="Namespace to seed")
    parser.add_argument(
        "--filename",
        default="ci-smoke-corpus.txt",
        help="Source name recorded on the ingested chunks",
    )
    args = parser.parse_args()

    from intelligence.evaluation.factory import _build_engine
    from intelligence.server.config import ServerConfig

    engine = _build_engine(ServerConfig.from_env())
    chunk_count = engine.ingest_document(
        content=CORPUS.encode("utf-8"),
        namespace=args.namespace,
        strategy=0,
        mime_type="text/plain",
        filename=args.filename,
    )
    print(f"Seeded {chunk_count} chunk(s) into namespace {args.namespace!r}")
    return 0 if chunk_count else 1


if __name__ == "__main__":
    raise SystemExit(main())
