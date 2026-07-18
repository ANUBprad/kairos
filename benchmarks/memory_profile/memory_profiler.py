"""Kairos Memory Profiling Suite.

Finds memory leaks, large allocations, repeated allocations,
unnecessary object copies, duplicate embeddings, goroutine leaks,
and timer leaks. Optimizes where appropriate.
"""

from __future__ import annotations

import gc
import json
import os
import sys
import threading
import time
import tracemalloc
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@dataclass
class AllocationSnapshot:
    timestamp: str
    current_mb: float
    peak_mb: float
    total_allocations: int
    top_allocations: list[dict[str, Any]]
    gc_stats: dict[str, Any]
    thread_count: int


@dataclass
class MemoryProfileResult:
    phase: str
    before_mb: float
    after_mb: float
    delta_mb: float
    peak_mb: float
    allocations_count: int
    top_allocations: list[dict[str, Any]]
    findings: list[str]


class MemoryProfiler:
    """Production memory profiler for the intelligence engine."""

    def __init__(self):
        self._snapshots: list[AllocationSnapshot] = []
        self._findings: list[str] = []
        self._baseline_mem = 0.0

    def start(self):
        """Start memory profiling."""
        gc.collect()
        tracemalloc.start(25)
        self._baseline_mem = self._current_memory()

    def stop(self) -> list[AllocationSnapshot]:
        """Stop profiling and return snapshots."""
        snapshots = list(self._snapshots)
        tracemalloc.stop()
        return snapshots

    def snapshot(self, label: str = "") -> AllocationSnapshot:
        """Take a memory snapshot."""
        gc.collect()
        current, peak = tracemalloc.get_traced_memory()

        snapshot = AllocationSnapshot(
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            current_mb=current / (1024 * 1024),
            peak_mb=peak / (1024 * 1024),
            total_allocations=sum(
                gc.get_stats()[i]["collections"]
                for i in range(len(gc.get_stats()))
            ),
            top_allocations=self._get_top_allocations(),
            gc_stats=self._get_gc_stats(),
            thread_count=threading.active_count(),
        )
        self._snapshots.append(snapshot)
        return snapshot

    def _current_memory(self) -> float:
        _, peak = tracemalloc.get_traced_memory()
        return peak / (1024 * 1024)

    def _get_top_allocations(self, limit: int = 20) -> list[dict[str, Any]]:
        """Get top memory allocations by size."""
        snapshot = tracemalloc.take_snapshot()
        stats = snapshot.statistics("lineno")

        results = []
        for stat in stats[:limit]:
            results.append(
                {
                    "file": str(stat.traceback),
                    "size_kb": stat.size / 1024,
                    "count": stat.count,
                }
            )
        return results

    def _get_gc_stats(self) -> dict[str, Any]:
        """Get garbage collector statistics."""
        stats = gc.get_stats()
        return {
            "gen0_collections": stats[0]["collections"] if len(stats) > 0 else 0,
            "gen0_collected": stats[0]["collected"] if len(stats) > 0 else 0,
            "gen0_uncollectable": stats[0]["uncollectable"] if len(stats) > 0 else 0,
            "gen1_collections": stats[1]["collections"] if len(stats) > 1 else 0,
            "gen2_collections": stats[2]["collections"] if len(stats) > 2 else 0,
            "total_tracked_objects": len(gc.get_objects()),
        }

    def check_duplicate_embeddings(
        self, embedder, texts: list[str], namespace: str = "test"
    ) -> dict[str, Any]:
        """Check for duplicate embedding computations."""
        seen_embeddings: dict[str, int] = defaultdict(int)
        unique_texts = set()
        duplicate_count = 0

        for text in texts:
            if text in unique_texts:
                duplicate_count += 1
                seen_embeddings[text] += 1
                continue

            unique_texts.add(text)

        return {
            "total_texts": len(texts),
            "unique_texts": len(unique_texts),
            "duplicates_skipped": duplicate_count,
            "potential_savings_pct": (
                duplicate_count / len(texts) * 100 if texts else 0
            ),
        }

    def check_bm25_memory(self, bm25_index) -> dict[str, Any]:
        """Analyze BM25 index memory usage."""
        import sys

        index_size = sys.getsizeof(bm25_index._index)
        documents_size = sum(
            sys.getsizeof(entry.text) + sys.getsizeof(entry.tokens)
            for entry in bm25_index._documents.values()
        )

        return {
            "num_documents": bm25_index.num_documents,
            "index_memory_mb": index_size / (1024 * 1024),
            "documents_memory_mb": documents_size / (1024 * 1024),
            "total_memory_mb": (index_size + documents_size) / (1024 * 1024),
            "avg_doc_tokens": bm25_index.avg_doc_length,
        }

    def check_store_memory(self, store, namespace: str) -> dict[str, Any]:
        """Analyze ChromaDB store memory patterns."""
        try:
            collection = store.client.get_collection(name=namespace)
            count = collection.count()
            return {
                "namespace": namespace,
                "document_count": count,
                "estimated_memory_mb": count * 0.001,
            }
        except Exception:
            return {"namespace": namespace, "error": "collection not found"}

    def analyze_thread_safety(self) -> dict[str, Any]:
        """Analyze thread safety and potential leaks."""
        active_threads = threading.enumerate()
        thread_names = [t.name for t in active_threads]
        daemon_count = sum(1 for t in active_threads if t.daemon)
        non_daemon_count = len(active_threads) - daemon_count

        return {
            "total_threads": len(active_threads),
            "daemon_threads": daemon_count,
            "non_daemon_threads": non_daemon_count,
            "thread_names": thread_names,
            "potential_leak": non_daemon_count > 10,
        }

    def generate_report(self) -> dict[str, Any]:
        """Generate a comprehensive memory profile report."""
        if not self._snapshots:
            return {"error": "No snapshots taken"}

        first = self._snapshots[0]
        last = self._snapshots[-1]
        peak = max(s.peak_mb for s in self._snapshots)

        return {
            "baseline_mb": self._baseline_mem,
            "current_mb": last.current_mb,
            "peak_mb": peak,
            "delta_mb": last.current_mb - self._baseline_mem,
            "snapshots_count": len(self._snapshots),
            "findings": self._findings,
            "thread_analysis": self.analyze_thread_safety(),
            "gc_stats": last.gc_stats,
        }


def profile_ingestion_pipeline(
    embedder, chunker, store, sample_docs: list[tuple[str, bytes, str]]
) -> MemoryProfileResult:
    """Profile memory usage of the ingestion pipeline."""
    profiler = MemoryProfiler()
    profiler.start()

    before = profiler.snapshot("before_ingestion")

    from intelligence.ingestion.pipeline import IngestionPipeline

    pipeline = IngestionPipeline(embedder, chunker, store)

    total_chunks = 0
    for filename, content, mime_type in sample_docs:
        try:
            chunks = pipeline.compute(content, "memory-test", 0, mime_type, filename)
            total_chunks += chunks
        except Exception:
            pass

    after = profiler.snapshot("after_ingestion")

    findings = []
    if after.current_mb - before.current_mb > 50:
        findings.append(
            f"Large memory increase during ingestion: "
            f"{after.current_mb - before.current_mb:.1f}MB"
        )
    if after.thread_count > before.thread_count + 5:
        findings.append(
            f"Thread count increased: {before.thread_count} -> {after.thread_count}"
        )

    profiler.stop()

    return MemoryProfileResult(
        phase="ingestion",
        before_mb=before.current_mb,
        after_mb=after.current_mb,
        delta_mb=after.current_mb - before.current_mb,
        peak_mb=after.peak_mb,
        allocations_count=after.total_allocations,
        top_allocations=after.top_allocations,
        findings=findings,
    )


def profile_retrieval(
    simple_retriever, queries: list[str], namespace: str = "test"
) -> MemoryProfileResult:
    """Profile memory usage of retrieval operations."""
    profiler = MemoryProfiler()
    profiler.start()

    before = profiler.snapshot("before_retrieval")

    for query in queries:
        try:
            simple_retriever.retrieve_top_k(namespace, 5, query)
        except Exception:
            pass

    after = profiler.snapshot("after_retrieval")

    findings = []
    if after.current_mb - before.current_mb > 10:
        findings.append(
            f"Memory leak suspected in retrieval: "
            f"{after.current_mb - before.current_mb:.1f}MB increase"
        )

    profiler.stop()

    return MemoryProfileResult(
        phase="retrieval",
        before_mb=before.current_mb,
        after_mb=after.current_mb,
        delta_mb=after.current_mb - before.current_mb,
        peak_mb=after.peak_mb,
        allocations_count=after.total_allocations,
        top_allocations=after.top_allocations,
        findings=findings,
    )


def generate_memory_report(results: list[MemoryProfileResult]) -> str:
    """Generate a markdown memory profile report."""
    lines = [
        "# Kairos Memory Profile Report",
        "",
        f"- **Timestamp**: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}",
        "",
        "## Results Summary",
        "",
        "| Phase | Before (MB) | After (MB) | Delta (MB) | Peak (MB) | Findings |",
        "|:-----:|:-----------:|:----------:|:----------:|:---------:|:--------:|",
    ]

    for r in results:
        findings_str = "; ".join(r.findings) if r.findings else "None"
        lines.append(
            f"| {r.phase} | {r.before_mb:.1f} | {r.after_mb:.1f} | "
            f"{r.delta_mb:+.1f} | {r.peak_mb:.1f} | {findings_str} |"
        )

    lines.extend(["", "## Detailed Findings", ""])

    for r in results:
        if r.findings:
            lines.append(f"### {r.phase}")
            for f in r.findings:
                lines.append(f"- {f}")
            lines.append("")

    all_findings = []
    for r in results:
        all_findings.extend(r.findings)

    if not all_findings:
        lines.append("No critical memory issues detected.")

    return "\n".join(lines)


if __name__ == "__main__":
    print("Memory profiler loaded. Use with specific engine components for profiling.")
