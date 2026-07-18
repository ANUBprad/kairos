"""Benchmark: Chunking strategies."""

from __future__ import annotations

import time

from benchmarks.performance.conftest import BenchmarkResult, generate_random_text, generate_sentences


def bench_fixed_size_chunking(text_sizes: list[int] | None = None, iterations: int = 50) -> list[BenchmarkResult]:
    """Benchmark fixed-size chunking at different text sizes."""
    from semantic_text_splitter import TextSplitter

    if text_sizes is None:
        text_sizes = [5000, 20000, 50000]

    results = []
    splitter = TextSplitter(capacity=1024, overlap=150)

    for size in text_sizes:
        text = generate_random_text(size)
        times = []
        for _ in range(iterations):
            start = time.perf_counter()
            splitter.chunks(text)
            end = time.perf_counter()
            times.append(end - start)

        results.append(BenchmarkResult(
            name=f"fixed_chunking_{size}chars",
            iterations=iterations,
            times=times,
        ))
    return results


def bench_structural_chunking(text_sizes: list[int] | None = None, iterations: int = 50) -> list[BenchmarkResult]:
    """Benchmark structural (form-feed) chunking."""
    if text_sizes is None:
        text_sizes = [5000, 20000, 50000]

    results = []
    for size in text_sizes:
        # Build text with form-feed page boundaries
        page_size = size // 5
        pages = [generate_random_text(page_size) for _ in range(5)]
        text = "\f".join(pages)

        times = []
        for _ in range(iterations):
            start = time.perf_counter()
            text.split("\f")
            end = time.perf_counter()
            times.append(end - start)

        results.append(BenchmarkResult(
            name=f"structural_chunking_{size}chars",
            iterations=iterations,
            times=times,
        ))
    return results


def bench_semantic_chunking_similarity(iterations: int = 50) -> BenchmarkResult:
    """Benchmark the cosine similarity computation in semantic chunking."""
    import numpy as np

    dim = 384  # all-MiniLM-L6-v2 dimensions
    num_sentences = 200
    embeddings = [np.random.randn(dim).tolist() for _ in range(num_sentences)]

    def cosine_sim(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = sum(x ** 2 for x in a) ** 0.5
        mag_b = sum(x ** 2 for x in b) ** 0.5
        return dot / (mag_a * mag_b)

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        for i in range(1, len(embeddings)):
            cosine_sim(embeddings[i - 1], embeddings[i])
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(
        name="semantic_chunking_similarity",
        iterations=iterations,
        times=times,
    )


def bench_semantic_chunking_numpy(iterations: int = 50) -> BenchmarkResult:
    """Benchmark numpy-vectorized cosine similarity for semantic chunking."""
    import numpy as np

    dim = 384
    num_sentences = 200
    embeddings = np.random.randn(num_sentences, dim)

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        normalized = embeddings / (norms + 1e-9)
        for i in range(1, len(normalized)):
            float(np.dot(normalized[i - 1], normalized[i]))
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(
        name="semantic_chunking_numpy",
        iterations=iterations,
        times=times,
    )


def run_all() -> list[BenchmarkResult]:
    results = []
    results.extend(bench_fixed_size_chunking())
    results.extend(bench_structural_chunking())
    results.append(bench_semantic_chunking_similarity())
    results.append(bench_semantic_chunking_numpy())
    return results


if __name__ == "__main__":
    for r in run_all():
        s = r.summary()
        print(f"{s['name']}: mean={s['mean_ms']:.2f}ms, p95={s['p95_ms']:.2f}ms")
