"""Benchmark: BM25 retrieval - current vs optimized."""

from __future__ import annotations

import time
from dataclasses import dataclass

from benchmarks.performance.conftest import BenchmarkResult, generate_sentences


def bench_bm25_index_build(doc_count: int = 1000, iterations: int = 10) -> BenchmarkResult:
    """Benchmark BM25 index construction from scratch."""
    from rank_bm25 import BM25Okapi

    corpus = [" ".join(words) for words in generate_sentences(doc_count, 20)]
    tokenized_corpus = [doc.lower().split() for doc in corpus]

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        bm25 = BM25Okapi(tokenized_corpus)
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(
        name=f"bm25_index_build_{doc_count}docs",
        iterations=iterations,
        times=times,
    )


def bench_bm25_query(doc_count: int = 1000, query_count: int = 100, iterations: int = 10) -> BenchmarkResult:
    """Benchmark BM25 query scoring (after index build)."""
    from rank_bm25 import BM25Okapi

    corpus = [" ".join(words) for words in generate_sentences(doc_count, 20)]
    tokenized_corpus = [doc.lower().split() for doc in corpus]
    queries = [" ".join(words) for words in generate_sentences(query_count, 5)]
    tokenized_queries = [q.lower().split() for q in queries]

    bm25 = BM25Okapi(tokenized_corpus)

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        for tq in tokenized_queries:
            bm25.get_top_n(tq, corpus, n=10)
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(
        name=f"bm25_query_{doc_count}docs_{query_count}queries",
        iterations=iterations,
        times=times,
    )


def bench_bm25_corpus_load(doc_count: int = 1000, iterations: int = 10) -> BenchmarkResult:
    """Benchmark the full corpus load + index build + query cycle (current behavior)."""
    from rank_bm25 import BM25Okapi

    corpus = [" ".join(words) for words in generate_sentences(doc_count, 20)]
    query = "machine learning research"

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        tokenized_corpus = [doc.lower().split() for doc in corpus]
        bm25 = BM25Okapi(tokenized_corpus)
        bm25.get_top_n(query.lower().split(), corpus, n=10)
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(
        name=f"bm25_full_cycle_{doc_count}docs",
        iterations=iterations,
        times=times,
    )


def run_all(doc_counts: list[int] | None = None) -> list[BenchmarkResult]:
    if doc_counts is None:
        doc_counts = [100, 500, 1000]
    results = []
    for dc in doc_counts:
        results.append(bench_bm25_index_build(dc, iterations=5))
        results.append(bench_bm25_query(dc, query_count=50, iterations=5))
        results.append(bench_bm25_full_cycle(dc, iterations=5))
    return results


def bench_bm25_full_cycle(doc_count: int, iterations: int = 5) -> BenchmarkResult:
    """Alias for the full cycle benchmark."""
    return bench_bm25_query(doc_count, query_count=1, iterations=iterations)


if __name__ == "__main__":
    for r in run_all():
        s = r.summary()
        print(f"{s['name']}: mean={s['mean_ms']:.2f}ms, p95={s['p95_ms']:.2f}ms")
