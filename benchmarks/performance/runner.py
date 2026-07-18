"""Main benchmark runner - orchestrates all performance benchmarks."""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone

from benchmarks.performance.conftest import BenchmarkResult


def _ensure_data_dir() -> str:
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


def run_document_benchmarks(iterations: int = 20) -> list[BenchmarkResult]:
    from benchmarks.performance.document_bench import run_all
    print("Running document parsing benchmarks...")
    return run_all(iterations)


def run_bm25_benchmarks() -> list[BenchmarkResult]:
    from benchmarks.performance.bm25_bench import run_all
    print("Running BM25 benchmarks...")
    return run_all(doc_counts=[100, 500])


def run_chunking_benchmarks() -> list[BenchmarkResult]:
    from benchmarks.performance.chunking_bench import run_all
    print("Running chunking benchmarks...")
    return run_all()


def run_embedding_benchmarks() -> list[BenchmarkResult]:
    from benchmarks.performance.embedding_bench import run_all
    print("Running embedding benchmarks...")
    return run_all()


def run_pipeline_benchmark(iterations: int = 10) -> list[BenchmarkResult]:
    """Benchmark the full ingestion pipeline end-to-end."""
    from benchmarks.performance.conftest import generate_random_text
    from intelligence.ingestion.document_loader import load_document
    from intelligence.ingestion.chunker import Chunker
    from intelligence.embeddings.local_embedder import LocalEmbedder

    print("Running full pipeline benchmark...")

    text = generate_random_text(20000)
    embedder = LocalEmbedder()
    chunker = Chunker(embedder, chunk_size=1024, overlap=150)

    # Simulate pipeline stages without ChromaDB
    times_parsing = []
    times_chunking = []
    times_embedding = []
    times_total = []

    for _ in range(iterations):
        # Parsing
        start = time.perf_counter()
        parsed_text = load_document(text.encode("utf-8"), "text/plain")
        end = time.perf_counter()
        times_parsing.append(end - start)

        # Chunking
        start = time.perf_counter()
        chunks = chunker.chunk(parsed_text, 0)  # fixed-size
        end = time.perf_counter()
        times_chunking.append(end - start)

        # Embedding
        start = time.perf_counter()
        embedder.embed_batch(chunks)
        end = time.perf_counter()
        times_embedding.append(end - start)

        # Total
        times_total.append(times_parsing[-1] + times_chunking[-1] + times_embedding[-1])

    return [
        BenchmarkResult(name="pipeline_parsing", iterations=iterations, times=times_parsing),
        BenchmarkResult(name="pipeline_chunking", iterations=iterations, times=times_chunking),
        BenchmarkResult(name="pipeline_embedding", iterations=iterations, times=times_embedding),
        BenchmarkResult(name="pipeline_total", iterations=iterations, times=times_total),
    ]


def save_results(results: list[BenchmarkResult], tag: str = "baseline") -> str:
    data_dir = _ensure_data_dir()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"benchmark_{tag}_{timestamp}.json"
    filepath = os.path.join(data_dir, filename)

    data = {
        "tag": tag,
        "timestamp": timestamp,
        "results": [r.summary() for r in results],
    }

    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\nResults saved to: {filepath}")
    return filepath


def print_results(results: list[BenchmarkResult]) -> None:
    print("\n" + "=" * 80)
    print(f"{'Benchmark':<45} {'Mean(ms)':>10} {'P95(ms)':>10} {'P99(ms)':>10} {'StdDev(ms)':>10}")
    print("-" * 80)
    for r in results:
        s = r.summary()
        print(
            f"{s['name']:<45} {s['mean_ms']:>10.2f} {s['p95_ms']:>10.2f} "
            f"{s['p99_ms']:>10.2f} {s['std_dev_ms']:>10.2f}"
        )
    print("=" * 80)


def main() -> None:
    tag = sys.argv[1] if len(sys.argv) > 1 else "baseline"

    print(f"Kairos Performance Benchmark Suite - Tag: {tag}")
    print(f"Started at: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)

    all_results: list[BenchmarkResult] = []

    try:
        all_results.extend(run_document_benchmarks(iterations=20))
    except Exception as e:
        print(f"Document benchmarks failed: {e}")

    try:
        all_results.extend(run_bm25_benchmarks())
    except Exception as e:
        print(f"BM25 benchmarks failed: {e}")

    try:
        all_results.extend(run_chunking_benchmarks())
    except Exception as e:
        print(f"Chunking benchmarks failed: {e}")

    try:
        all_results.extend(run_embedding_benchmarks())
    except Exception as e:
        print(f"Embedding benchmarks failed: {e}")

    try:
        all_results.extend(run_pipeline_benchmark(iterations=5))
    except Exception as e:
        print(f"Pipeline benchmark failed: {e}")

    print_results(all_results)
    save_results(all_results, tag)

    print(f"\nCompleted at: {datetime.now(timezone.utc).isoformat()}")


if __name__ == "__main__":
    main()
