"""Generate markdown comparison reports from benchmark results."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone


def load_results(filepath: str) -> dict:
    with open(filepath) as f:
        return json.load(f)


def generate_comparison_report(baseline_path: str, optimized_path: str) -> str:
    baseline = load_results(baseline_path)
    optimized = load_results(optimized_path)

    b_results = {r["name"]: r for r in baseline["results"]}
    o_results = {r["name"]: r for r in optimized["results"]}

    lines = [
        "# Kairos Performance Benchmark Report",
        "",
        f"**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        f"**Baseline:** {baseline['tag']} ({baseline['timestamp']})",
        f"**Optimized:** {optimized['tag']} ({optimized['timestamp']})",
        "",
        "---",
        "",
        "## Summary",
        "",
        "| Benchmark | Baseline Mean(ms) | Optimized Mean(ms) | Improvement | Status |",
        "|-----------|-------------------|-------------------|-------------|--------|",
    ]

    improved = 0
    regressed = 0
    unchanged = 0

    all_names = sorted(set(list(b_results.keys()) + list(o_results.keys())))

    for name in all_names:
        b = b_results.get(name)
        o = o_results.get(name)
        if b and o:
            b_mean = b["mean_ms"]
            o_mean = o["mean_ms"]
            if b_mean > 0:
                pct = ((b_mean - o_mean) / b_mean) * 100
            else:
                pct = 0.0

            if pct > 5:
                status = "IMPROVED"
                improved += 1
            elif pct < -5:
                status = "REGRESSED"
                regressed += 1
            else:
                status = "STABLE"
                unchanged += 1

            lines.append(
                f"| {name} | {b_mean:.2f} | {o_mean:.2f} | {pct:+.1f}% | {status} |"
            )
        elif b:
            lines.append(f"| {name} | {b['mean_ms']:.2f} | N/A | - | SKIPPED |")
        elif o:
            lines.append(f"| {name} | N/A | {o['mean_ms']:.2f} | - | NEW |")

    lines.extend([
        "",
        f"**Results:** {improved} improved, {unchanged} stable, {regressed} regressed",
        "",
        "---",
        "",
        "## Detailed Results",
        "",
    ])

    for name in all_names:
        b = b_results.get(name)
        o = o_results.get(name)
        lines.append(f"### {name}")
        lines.append("")
        if b:
            lines.append(f"- **Baseline:** mean={b['mean_ms']:.2f}ms, p95={b['p95_ms']:.2f}ms, p99={b['p99_ms']:.2f}ms, std={b['std_dev_ms']:.2f}ms")
        if o:
            lines.append(f"- **Optimized:** mean={o['mean_ms']:.2f}ms, p95={o['p95_ms']:.2f}ms, p99={o['p99_ms']:.2f}ms, std={o['std_dev_ms']:.2f}ms")
        if b and o and b["mean_ms"] > 0:
            pct = ((b["mean_ms"] - o["mean_ms"]) / b["mean_ms"]) * 100
            lines.append(f"- **Change:** {pct:+.1f}%")
        lines.append("")

    lines.extend([
        "---",
        "",
        "## Methodology",
        "",
        "- Each benchmark runs multiple iterations and reports mean, median, P95, P99",
        "- Memory usage is measured via `psutil.Process.memory_info().rss`",
        "- All benchmarks use `time.perf_counter()` for high-precision timing",
        "- Results are saved as JSON for reproducibility",
        "",
    ])

    return "\n".join(lines)


def main():
    import sys

    if len(sys.argv) < 3:
        print("Usage: python -m benchmarks.performance.report <baseline.json> <optimized.json> [output.md]")
        sys.exit(1)

    baseline_path = sys.argv[1]
    optimized_path = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else "benchmark_report.md"

    report = generate_comparison_report(baseline_path, optimized_path)

    with open(output_path, "w") as f:
        f.write(report)

    print(f"Report written to: {output_path}")


if __name__ == "__main__":
    main()
