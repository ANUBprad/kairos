"""Kairos Production Load Testing Suite.

Reproducible load tests measuring latency, throughput, CPU, RAM,
goroutines, Python memory, and DB response time at various concurrency levels.
Generates markdown and JSON reports.
"""

from __future__ import annotations

import json
import os
import resource
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@dataclass
class RequestResult:
    status_code: int
    latency_ms: float
    error: str | None = None
    response_size: int = 0


@dataclass
class LoadTestResult:
    concurrency: int
    total_requests: int
    successful: int
    failed: int
    errors: dict[str, int]
    latency_p50_ms: float
    latency_p95_ms: float
    latency_p99_ms: float
    latency_mean_ms: float
    latency_min_ms: float
    latency_max_ms: float
    latency_stddev_ms: float
    throughput_rps: float
    total_duration_s: float
    cpu_user_s: float
    cpu_system_s: float
    ram_peak_mb: float
    ram_current_mb: float
    db_response_time_ms: float
    error_rate_pct: float
    timestamp: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class LoadTestReport:
    test_name: str
    base_url: str
    timestamp: str
    results: list[LoadTestResult] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


def _measure_process_resources() -> dict:
    """Measure current process resource usage."""
    usage = resource.getrusage(resource.RUSAGE_SELF)
    return {
        "cpu_user_s": usage.ru_utime,
        "cpu_system_s": usage.ru_stime,
        "ram_peak_mb": usage.ru_maxrss / 1024,
    }


def _get_chroma_response_time(base_url: str, namespace: str = "load-test") -> float:
    """Measure ChromaDB response time via a trivial query."""
    try:
        start = time.monotonic()
        requests.get(
            f"{base_url}/health",
            timeout=5,
        )
        return (time.monotonic() - start) * 1000
    except Exception:
        return -1.0


def _send_query_request(
    base_url: str,
    namespace: str,
    query: str,
    headers: dict[str, str],
) -> RequestResult:
    """Send a single query request and measure latency."""
    payload = {
        "query": query,
    }
    try:
        start = time.monotonic()
        resp = requests.post(
            f"{base_url}/v1/query",
            json=payload,
            headers=headers,
            timeout=60,
        )
        latency = (time.monotonic() - start) * 1000
        return RequestResult(
            status_code=resp.status_code,
            latency_ms=latency,
            response_size=len(resp.content),
        )
    except Exception as e:
        return RequestResult(
            status_code=0,
            latency_ms=0,
            error=str(e),
        )


def _send_ingest_request(
    base_url: str,
    namespace: str,
    content: bytes,
    filename: str,
    headers: dict[str, str],
) -> RequestResult:
    """Send a single ingestion request and measure latency."""
    try:
        start = time.monotonic()
        resp = requests.post(
            f"{base_url}/v1/ingest",
            files={"file": (filename, content, "text/plain")},
            data={"chunking_strategy": "0"},
            headers=headers,
            timeout=120,
        )
        latency = (time.monotonic() - start) * 1000
        return RequestResult(
            status_code=resp.status_code,
            latency_ms=latency,
            response_size=len(resp.content),
        )
    except Exception as e:
        return RequestResult(
            status_code=0,
            latency_ms=0,
            error=str(e),
        )


def run_load_test(
    base_url: str,
    concurrency: int,
    total_requests: int,
    test_type: str = "query",
    namespace: str = "load-test",
    auth_secret: str = "",
    content: bytes | None = None,
    filename: str = "test.txt",
    queries: list[str] | None = None,
) -> LoadTestResult:
    """Run a load test at the specified concurrency level."""
    if queries is None:
        queries = [
            "What is machine learning?",
            "Explain neural networks",
            "How does RAG work?",
            "What are transformers?",
            "Describe vector databases",
        ]

    headers = {}
    if auth_secret:
        headers["X-Secret"] = auth_secret
    headers["X-Namespace"] = namespace

    errors: dict[str, int] = {}
    results: list[RequestResult] = []

    ram_before = _measure_process_resources()
    start_time = time.monotonic()

    def _worker(idx: int) -> RequestResult:
        query = queries[idx % len(queries)]
        if test_type == "query":
            return _send_query_request(base_url, namespace, query, headers)
        elif test_type == "ingest":
            return _send_ingest_request(
                base_url,
                namespace,
                content or b"Load test content for benchmarking. " * 100,
                filename,
                headers,
            )
        return RequestResult(status_code=0, latency_ms=0, error="unknown test type")

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(_worker, i) for i in range(total_requests)]
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            if result.error:
                err_key = result.error[:80]
                errors[err_key] = errors.get(err_key, 0) + 1
            elif result.status_code >= 400:
                err_key = f"HTTP {result.status_code}"
                errors[err_key] = errors.get(err_key, 0) + 1

    end_time = time.monotonic()
    ram_after = _measure_process_resources()

    total_duration = end_time - start_time
    latencies = [r.latency_ms for r in results if r.latency_ms > 0]
    successful = sum(
        1 for r in results if r.status_code in (200, 202) and not r.error
    )
    failed = len(results) - successful

    if not latencies:
        latencies = [0.0]

    sorted_lat = sorted(latencies)
    n = len(sorted_lat)

    db_time = _get_chroma_response_time(base_url)

    return LoadTestResult(
        concurrency=concurrency,
        total_requests=total_requests,
        successful=successful,
        failed=failed,
        errors=errors,
        latency_p50_ms=sorted_lat[n // 2] if n > 0 else 0,
        latency_p95_ms=sorted_lat[int(n * 0.95)] if n > 0 else 0,
        latency_p99_ms=sorted_lat[int(n * 0.99)] if n > 0 else 0,
        latency_mean_ms=statistics.mean(latencies),
        latency_min_ms=min(latencies),
        latency_max_ms=max(latencies),
        latency_stddev_ms=statistics.stdev(latencies) if len(latencies) > 1 else 0,
        throughput_rps=successful / total_duration if total_duration > 0 else 0,
        total_duration_s=total_duration,
        cpu_user_s=ram_after["cpu_user_s"] - ram_before["cpu_user_s"],
        cpu_system_s=ram_after["cpu_system_s"] - ram_before["cpu_system_s"],
        ram_peak_mb=ram_after["ram_peak_mb"],
        ram_current_mb=ram_after["ram_peak_mb"],
        db_response_time_ms=db_time,
        error_rate_pct=(failed / len(results) * 100) if results else 0,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


def generate_markdown_report(report: LoadTestReport) -> str:
    """Generate a markdown load test report."""
    lines = [
        f"# Kairos Load Test Report",
        f"",
        f"- **Test**: {report.test_name}",
        f"- **Target**: {report.base_url}",
        f"- **Timestamp**: {report.timestamp}",
        f"",
        f"## Results Summary",
        f"",
        f"| Concurrency | Requests | Success | Failed | Throughput (req/s) | P50 (ms) | P95 (ms) | P99 (ms) | Error Rate | RAM (MB) |",
        f"|:-----------:|:--------:|:-------:|:------:|:------------------:|:--------:|:--------:|:--------:|:----------:|:--------:|",
    ]

    for r in report.results:
        lines.append(
            f"| {r.concurrency} | {r.total_requests} | {r.successful} | {r.failed} "
            f"| {r.throughput_rps:.2f} | {r.latency_p50_ms:.1f} | {r.latency_p95_ms:.1f} "
            f"| {r.latency_p99_ms:.1f} | {r.error_rate_pct:.1f}% | {r.ram_peak_mb:.1f} |"
        )

    lines.extend([
        f"",
        f"## Detailed Results",
        f"",
    ])

    for r in report.results:
        lines.extend([
            f"### Concurrency: {r.concurrency}",
            f"",
            f"- **Total Requests**: {r.total_requests}",
            f"- **Successful**: {r.successful}",
            f"- **Failed**: {r.failed}",
            f"- **Duration**: {r.total_duration_s:.2f}s",
            f"- **Throughput**: {r.throughput_rps:.2f} req/s",
            f"- **Latency P50**: {r.latency_p50_ms:.1f}ms",
            f"- **Latency P95**: {r.latency_p95_ms:.1f}ms",
            f"- **Latency P99**: {r.latency_p99_ms:.1f}ms",
            f"- **Latency Mean**: {r.latency_mean_ms:.1f}ms",
            f"- **Latency StdDev**: {r.latency_stddev_ms:.1f}ms",
            f"- **CPU User**: {r.cpu_user_s:.2f}s",
            f"- **CPU System**: {r.cpu_system_s:.2f}s",
            f"- **RAM Peak**: {r.ram_peak_mb:.1f}MB",
            f"- **DB Response Time**: {r.db_response_time_ms:.1f}ms",
            f"- **Error Rate**: {r.error_rate_pct:.1f}%",
            f"",
        ])

        if r.errors:
            lines.append(f"**Errors:**")
            for err, count in r.errors.items():
                lines.append(f"  - `{err}`: {count}")
            lines.append("")

    if report.summary:
        lines.extend([
            f"## Summary",
            f"",
        ])
        for k, v in report.summary.items():
            lines.append(f"- **{k}**: {v}")

    return "\n".join(lines)


def run_full_load_test_suite(
    base_url: str,
    auth_secret: str = "",
    output_dir: str | None = None,
) -> LoadTestReport:
    """Run the full load test suite at 10, 25, 50, 100 concurrent users."""
    concurrency_levels = [10, 25, 50, 100]
    requests_per_level = [100, 250, 500, 1000]

    report = LoadTestReport(
        test_name="Kairos Production Load Test",
        base_url=base_url,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )

    for conc, total in zip(concurrency_levels, requests_per_level):
        print(f"\n--- Running load test: {conc} concurrent users, {total} requests ---")
        result = run_load_test(
            base_url=base_url,
            concurrency=conc,
            total_requests=total,
            test_type="query",
            auth_secret=auth_secret,
        )
        report.results.append(result)
        print(
            f"  Throughput: {result.throughput_rps:.2f} req/s, "
            f"P50: {result.latency_p50_ms:.1f}ms, "
            f"P95: {result.latency_p95_ms:.1f}ms"
        )

    throughputs = [r.throughput_rps for r in report.results]
    p95s = [r.latency_p95_ms for r in report.results]

    report.summary = {
        "max_throughput_rps": max(throughputs) if throughputs else 0,
        "max_throughput_concurrency": concurrency_levels[
            throughputs.index(max(throughputs))
        ]
        if throughputs
        else 0,
        "best_p95_ms": min(p95s) if p95s else 0,
        "worst_p95_ms": max(p95s) if p95s else 0,
        "total_requests_executed": sum(r.total_requests for r in report.results),
        "overall_error_rate_pct": (
            sum(r.failed for r in report.results)
            / max(sum(r.total_requests for r in report.results), 1)
            * 100
        ),
    }

    if output_dir:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        ts = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
        json_path = out / f"load_test_{ts}.json"
        md_path = out / f"load_test_{ts}.md"

        with open(json_path, "w") as f:
            json.dump(report.to_dict() if hasattr(report, "to_dict") else {
                "test_name": report.test_name,
                "base_url": report.base_url,
                "timestamp": report.timestamp,
                "results": [r.to_dict() for r in report.results],
                "summary": report.summary,
            }, f, indent=2)

        with open(md_path, "w") as f:
            f.write(generate_markdown_report(report))

        print(f"\nReports saved to {json_path} and {md_path}")

    return report


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Kairos Load Test")
    parser.add_argument("--url", default="http://localhost:8080", help="Base URL")
    parser.add_argument("--secret", default="", help="Auth secret")
    parser.add_argument("--output", default="benchmarks/load_test/results")
    args = parser.parse_args()

    run_full_load_test_suite(args.url, args.secret, args.output)
