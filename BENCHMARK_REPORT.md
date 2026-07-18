# Kairos Performance Benchmark Report

**Generated:** 2026-07-18 14:29:22 UTC
**Baseline:** baseline (20260718_142748)
**Optimized:** optimized (20260718_142910)

---

## Summary

| Benchmark | Baseline Mean(ms) | Optimized Mean(ms) | Improvement | Status |
|-----------|-------------------|-------------------|-------------|--------|
| batch_embedding_10 | 404.34 | 123.81 | +69.4% | IMPROVED |
| batch_embedding_100 | 3861.15 | 1014.76 | +73.7% | IMPROVED |
| batch_embedding_200 | 7822.89 | 1900.54 | +75.7% | IMPROVED |
| batch_embedding_50 | 1888.67 | 533.16 | +71.8% | IMPROVED |
| bm25_index_build_100docs | 2.01 | 1.49 | +25.8% | IMPROVED |
| bm25_index_build_500docs | 6.54 | 5.88 | +10.0% | IMPROVED |
| bm25_query_100docs_1queries | 0.68 | 0.79 | -14.9% | REGRESSED |
| bm25_query_100docs_50queries | 37.42 | 31.25 | +16.5% | IMPROVED |
| bm25_query_500docs_1queries | 2.52 | 2.81 | -11.2% | REGRESSED |
| bm25_query_500docs_50queries | 111.72 | 97.58 | +12.7% | IMPROVED |
| cached_embedder_hit | 0.00 | 0.00 | -100.0% | REGRESSED |
| cached_embedder_miss | 18.27 | 24.22 | -32.5% | REGRESSED |
| document_loader_full | 16.12 | 13.32 | +17.4% | IMPROVED |
| fixed_chunking_20000chars | 0.13 | 0.09 | +26.0% | IMPROVED |
| fixed_chunking_50000chars | 0.65 | 0.62 | +4.7% | STABLE |
| fixed_chunking_5000chars | 0.16 | 0.04 | +78.5% | IMPROVED |
| pdf_parsing | 14.03 | 13.29 | +5.3% | IMPROVED |
| pipeline_chunking | 0.28 | 0.29 | -3.6% | STABLE |
| pipeline_embedding | 580.23 | 565.26 | +2.6% | STABLE |
| pipeline_parsing | 0.01 | 0.01 | +7.1% | IMPROVED |
| pipeline_total | 580.52 | 565.56 | +2.6% | STABLE |
| semantic_chunking_numpy | 0.44 | 0.59 | -34.2% | REGRESSED |
| semantic_chunking_similarity | 22.06 | 21.71 | +1.6% | STABLE |
| single_embedding | 50.67 | 18.81 | +62.9% | IMPROVED |
| structural_chunking_20000chars | 0.01 | 0.01 | -12.5% | REGRESSED |
| structural_chunking_50000chars | 0.02 | 0.02 | -11.8% | REGRESSED |
| structural_chunking_5000chars | 0.00 | 0.00 | +0.0% | STABLE |
| text_decoding | 0.00 | 0.00 | +0.0% | STABLE |

**Results:** 14 improved, 7 stable, 7 regressed

---

## Detailed Results

### batch_embedding_10

- **Baseline:** mean=404.34ms, p95=490.82ms, p99=490.82ms, std=31.71ms
- **Optimized:** mean=123.81ms, p95=195.86ms, p99=195.86ms, std=25.45ms
- **Change:** +69.4%

### batch_embedding_100

- **Baseline:** mean=3861.15ms, p95=3982.93ms, p99=3982.93ms, std=74.39ms
- **Optimized:** mean=1014.76ms, p95=1059.67ms, p99=1059.67ms, std=22.46ms
- **Change:** +73.7%

### batch_embedding_200

- **Baseline:** mean=7822.89ms, p95=8925.21ms, p99=8925.21ms, std=1237.68ms
- **Optimized:** mean=1900.54ms, p95=2042.16ms, p99=2042.16ms, std=61.73ms
- **Change:** +75.7%

### batch_embedding_50

- **Baseline:** mean=1888.67ms, p95=2448.21ms, p99=2448.21ms, std=200.10ms
- **Optimized:** mean=533.16ms, p95=541.29ms, p99=541.29ms, std=4.56ms
- **Change:** +71.8%

### bm25_index_build_100docs

- **Baseline:** mean=2.01ms, p95=2.73ms, p99=2.73ms, std=0.62ms
- **Optimized:** mean=1.49ms, p95=2.15ms, p99=2.15ms, std=0.50ms
- **Change:** +25.8%

### bm25_index_build_500docs

- **Baseline:** mean=6.54ms, p95=7.37ms, p99=7.37ms, std=0.69ms
- **Optimized:** mean=5.88ms, p95=6.56ms, p99=6.56ms, std=0.41ms
- **Change:** +10.0%

### bm25_query_100docs_1queries

- **Baseline:** mean=0.68ms, p95=0.70ms, p99=0.70ms, std=0.01ms
- **Optimized:** mean=0.79ms, p95=0.92ms, p99=0.92ms, std=0.10ms
- **Change:** -14.9%

### bm25_query_100docs_50queries

- **Baseline:** mean=37.42ms, p95=52.61ms, p99=52.61ms, std=9.29ms
- **Optimized:** mean=31.25ms, p95=36.45ms, p99=36.45ms, std=3.68ms
- **Change:** +16.5%

### bm25_query_500docs_1queries

- **Baseline:** mean=2.52ms, p95=2.84ms, p99=2.84ms, std=0.27ms
- **Optimized:** mean=2.81ms, p95=3.47ms, p99=3.47ms, std=0.52ms
- **Change:** -11.2%

### bm25_query_500docs_50queries

- **Baseline:** mean=111.72ms, p95=122.30ms, p99=122.30ms, std=7.56ms
- **Optimized:** mean=97.58ms, p95=101.82ms, p99=101.82ms, std=4.96ms
- **Change:** +12.7%

### cached_embedder_hit

- **Baseline:** mean=0.00ms, p95=0.00ms, p99=0.01ms, std=0.00ms
- **Optimized:** mean=0.00ms, p95=0.00ms, p99=0.01ms, std=0.00ms
- **Change:** -100.0%

### cached_embedder_miss

- **Baseline:** mean=18.27ms, p95=35.82ms, p99=63.34ms, std=9.93ms
- **Optimized:** mean=24.22ms, p95=29.29ms, p99=58.79ms, std=7.46ms
- **Change:** -32.5%

### document_loader_full

- **Baseline:** mean=16.12ms, p95=36.07ms, p99=36.07ms, std=5.87ms
- **Optimized:** mean=13.32ms, p95=20.69ms, p99=20.69ms, std=2.22ms
- **Change:** +17.4%

### fixed_chunking_20000chars

- **Baseline:** mean=0.13ms, p95=0.17ms, p99=0.22ms, std=0.03ms
- **Optimized:** mean=0.09ms, p95=0.13ms, p99=0.21ms, std=0.02ms
- **Change:** +26.0%

### fixed_chunking_50000chars

- **Baseline:** mean=0.65ms, p95=1.04ms, p99=1.38ms, std=0.19ms
- **Optimized:** mean=0.62ms, p95=0.82ms, p99=1.39ms, std=0.16ms
- **Change:** +4.7%

### fixed_chunking_5000chars

- **Baseline:** mean=0.16ms, p95=0.07ms, p99=6.35ms, std=0.89ms
- **Optimized:** mean=0.04ms, p95=0.04ms, p99=0.22ms, std=0.03ms
- **Change:** +78.5%

### pdf_parsing

- **Baseline:** mean=14.03ms, p95=17.10ms, p99=17.10ms, std=1.49ms
- **Optimized:** mean=13.29ms, p95=22.41ms, p99=22.41ms, std=3.05ms
- **Change:** +5.3%

### pipeline_chunking

- **Baseline:** mean=0.28ms, p95=0.52ms, p99=0.52ms, std=0.13ms
- **Optimized:** mean=0.29ms, p95=0.66ms, p99=0.66ms, std=0.21ms
- **Change:** -3.6%

### pipeline_embedding

- **Baseline:** mean=580.23ms, p95=680.40ms, p99=680.40ms, std=56.25ms
- **Optimized:** mean=565.26ms, p95=670.35ms, p99=670.35ms, std=59.19ms
- **Change:** +2.6%

### pipeline_parsing

- **Baseline:** mean=0.01ms, p95=0.03ms, p99=0.03ms, std=0.01ms
- **Optimized:** mean=0.01ms, p95=0.03ms, p99=0.03ms, std=0.01ms
- **Change:** +7.1%

### pipeline_total

- **Baseline:** mean=580.52ms, p95=680.95ms, p99=680.95ms, std=56.39ms
- **Optimized:** mean=565.56ms, p95=671.03ms, p99=671.03ms, std=59.40ms
- **Change:** +2.6%

### semantic_chunking_numpy

- **Baseline:** mean=0.44ms, p95=0.63ms, p99=4.16ms, std=0.54ms
- **Optimized:** mean=0.59ms, p95=0.87ms, p99=1.05ms, std=0.13ms
- **Change:** -34.2%

### semantic_chunking_similarity

- **Baseline:** mean=22.06ms, p95=35.59ms, p99=42.89ms, std=5.43ms
- **Optimized:** mean=21.71ms, p95=33.01ms, p99=37.18ms, std=4.67ms
- **Change:** +1.6%

### single_embedding

- **Baseline:** mean=50.67ms, p95=75.42ms, p99=271.09ms, std=42.67ms
- **Optimized:** mean=18.81ms, p95=25.32ms, p99=41.63ms, std=5.87ms
- **Change:** +62.9%

### structural_chunking_20000chars

- **Baseline:** mean=0.01ms, p95=0.01ms, p99=0.01ms, std=0.00ms
- **Optimized:** mean=0.01ms, p95=0.01ms, p99=0.01ms, std=0.00ms
- **Change:** -12.5%

### structural_chunking_50000chars

- **Baseline:** mean=0.02ms, p95=0.02ms, p99=0.02ms, std=0.00ms
- **Optimized:** mean=0.02ms, p95=0.02ms, p99=0.02ms, std=0.00ms
- **Change:** -11.8%

### structural_chunking_5000chars

- **Baseline:** mean=0.00ms, p95=0.00ms, p99=0.00ms, std=0.00ms
- **Optimized:** mean=0.00ms, p95=0.00ms, p99=0.00ms, std=0.00ms
- **Change:** +0.0%

### text_decoding

- **Baseline:** mean=0.00ms, p95=0.01ms, p99=0.01ms, std=0.00ms
- **Optimized:** mean=0.00ms, p95=0.01ms, p99=0.01ms, std=0.00ms
- **Change:** +0.0%

---

## Methodology

- Each benchmark runs multiple iterations and reports mean, median, P95, P99
- Memory usage is measured via `psutil.Process.memory_info().rss`
- All benchmarks use `time.perf_counter()` for high-precision timing
- Results are saved as JSON for reproducibility
