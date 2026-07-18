"""Benchmark: Embedding generation."""

from __future__ import annotations

import time

from benchmarks.performance.conftest import BenchmarkResult, generate_sentences


def bench_single_embedding(iterations: int = 50) -> BenchmarkResult:
    """Benchmark single text embedding."""
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    text = "This is a sample text for embedding benchmark testing purposes only."

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        model.encode(text)
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(name="single_embedding", iterations=iterations, times=times)


def bench_batch_embedding(batch_sizes: list[int] | None = None, iterations: int = 20) -> list[BenchmarkResult]:
    """Benchmark batch embedding at different sizes."""
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")

    if batch_sizes is None:
        batch_sizes = [10, 50, 100, 200]

    results = []
    for bs in batch_sizes:
        texts = [" ".join(words) for words in generate_sentences(bs, 15)]
        times = []
        for _ in range(iterations):
            start = time.perf_counter()
            model.encode(texts, batch_size=bs)
            end = time.perf_counter()
            times.append(end - start)

        results.append(BenchmarkResult(
            name=f"batch_embedding_{bs}",
            iterations=iterations,
            times=times,
        ))
    return results


def bench_cached_embedder_hit(iterations: int = 200) -> BenchmarkResult:
    """Benchmark CachedEmbedder when cache is warm (all hits)."""
    from intelligence.embeddings.cached_embedder import CachedEmbedder
    from intelligence.embeddings.local_embedder import LocalEmbedder
    from intelligence.cache.embedding_cache import EmbeddingCache

    inner = LocalEmbedder()
    cache = EmbeddingCache(maxsize=10000, ttl_seconds=300)
    cached = CachedEmbedder(inner=inner, cache=cache)

    text = "Benchmark text for cache hit measurement."
    # Warm the cache
    cached.embed(text)

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        cached.embed(text)
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(name="cached_embedder_hit", iterations=iterations, times=times)


def bench_cached_embedder_miss(iterations: int = 50) -> BenchmarkResult:
    """Benchmark CachedEmbedder when cache is cold (all misses)."""
    from intelligence.embeddings.cached_embedder import CachedEmbedder
    from intelligence.embeddings.local_embedder import LocalEmbedder
    from intelligence.cache.embedding_cache import EmbeddingCache

    inner = LocalEmbedder()
    cache = EmbeddingCache(maxsize=10000, ttl_seconds=300)
    cached = CachedEmbedder(inner=inner, cache=cache)

    texts = [f"Unique benchmark text number {i} for cache miss measurement." for i in range(iterations)]

    times = []
    for text in texts:
        start = time.perf_counter()
        cached.embed(text)
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(name="cached_embedder_miss", iterations=iterations, times=times)


def run_all() -> list[BenchmarkResult]:
    results = []
    results.append(bench_single_embedding(iterations=30))
    results.extend(bench_batch_embedding(iterations=10))
    results.append(bench_cached_embedder_hit(iterations=100))
    results.append(bench_cached_embedder_miss(iterations=30))
    return results


if __name__ == "__main__":
    for r in run_all():
        s = r.summary()
        print(f"{s['name']}: mean={s['mean_ms']:.2f}ms, p95={s['p95_ms']:.2f}ms")
