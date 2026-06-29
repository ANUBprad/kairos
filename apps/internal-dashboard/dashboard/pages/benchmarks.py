from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd

from dashboard.theme import Color, inject_css
from dashboard.components import (
    sidebar, footer, page_header, kpi_row,
    chart_container, bar_chart, grouped_bar,
    insight_box, styled_dataframe,
)

try:
    from intelligence.benchmarks import BenchmarkResult, aggregate_results
    from intelligence.reporting.visualization import plot_benchmark_comparison
except ImportError:
    st.error("Benchmark module not available")
    st.stop()

st.set_page_config(page_title="Benchmarks — Kairos", page_icon="🍁", layout="wide")
inject_css()


def main() -> None:
    sidebar()
    page_header("📊  Benchmarks", "Analyze retrieval performance across datasets and configurations")
    st.warning("No benchmark results loaded. Run benchmarks in `intelligence/benchmarks` first.")

    st.info(
        "Integrate the `BenchmarkResult` from `intelligence.benchmarks` or load a "
        "previously saved benchmark manifest using `intelligence.reporting.generate_benchmark_manifest()`."
    )

    if st.checkbox("Show demo data"):
        demo_results = [
            BenchmarkResult(
                dataset_name="EU AI Act",
                query_count=100,
                per_query_recall=[0.85] * 100,
                per_query_precision=[0.72] * 100,
                per_query_latency_ms=[145.0] * 100,
                metrics={"timeout_count": 2, "fallback_count": 5},
            ),
            BenchmarkResult(
                dataset_name="Legal Bench",
                query_count=80,
                per_query_recall=[0.78] * 80,
                per_query_precision=[0.65] * 80,
                per_query_latency_ms=[180.0] * 80,
                metrics={"timeout_count": 1, "fallback_count": 3},
            ),
        ]

        kpi_row([
            {"label": "Datasets", "value": str(len(demo_results))},
            {"label": "Total Queries", "value": str(sum(r.query_count for r in demo_results))},
            {"label": "Avg Recall", "value": f"{sum(r.average_recall for r in demo_results) / len(demo_results):.1%}"},
            {"label": "Avg Precision", "value": f"{sum(r.average_precision for r in demo_results) / len(demo_results):.1%}"},
        ])

        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Per-Dataset Metrics")
            data = []
            for r in demo_results:
                data.append({
                    "Dataset": r.dataset_name,
                    "Queries": r.query_count,
                    "Recall": f"{r.average_recall:.3f}",
                    "Precision": f"{r.average_precision:.3f}",
                    "Latency (ms)": f"{r.average_latency_ms:.1f}",
                    "Success": round(r.success_rate * 100, 1),
                    "Fallback": round(r.fallback_rate * 100, 1),
                })
            styled_dataframe(pd.DataFrame(data))

        with col2:
            st.subheader("Recall Comparison")
            img = plot_benchmark_comparison(demo_results)
            st.image(img)

        st.subheader("Aggregate Summary")
        agg = aggregate_results(demo_results)
        agg_df = pd.DataFrame([{
            k: (f"{v:.3f}" if isinstance(v, float) else v)
            for k, v in agg.items()
        }])
        styled_dataframe(agg_df)

        insight_box(
            "<strong>Benchmark Insight:</strong> The EU AI Act dataset shows stronger retrieval "
            "performance across all metrics compared to Legal Bench. Consider tuning chunk size "
            "and embedding models for legal domain text."
        )

    footer()


if __name__ == "__main__":
    main()
