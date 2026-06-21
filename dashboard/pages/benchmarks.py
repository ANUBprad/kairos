"""Benchmark Explorer page."""

from __future__ import annotations

import streamlit as st
import plotly.express as px
import pandas as pd

try:
    from intelligence.benchmarks import BenchmarkResult, aggregate_results
    from intelligence.reporting.visualization import plot_benchmark_comparison
except ImportError:
    st.error("Benchmark module not available")
    st.stop()

st.set_page_config(page_title="Benchmarks", page_icon="📊", layout="wide")
st.title("📊 Benchmark Explorer")


def main() -> None:
    st.warning("No benchmark results loaded. Run benchmarks in `intelligence/benchmarks` first.")

    st.info(
        """
        To see benchmark data here, integrate the `BenchmarkResult` from
        `intelligence.benchmarks` or load a previously saved benchmark manifest
        using `intelligence.reporting.generate_benchmark_manifest()`.
        """
    )

    # Demo mode: show how data would render
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
                    "Success": f"{r.success_rate:.1%}",
                    "Fallback": f"{r.fallback_rate:.1%}",
                })
            st.dataframe(pd.DataFrame(data), use_container_width=True)

        with col2:
            st.subheader("Recall Comparison")
            img = plot_benchmark_comparison(demo_results)
            st.image(img, use_container_width=True)

        st.subheader("Aggregate Summary")
        agg = aggregate_results(demo_results)
        agg_df = pd.DataFrame([{
            k: (f"{v:.3f}" if isinstance(v, float) else v)
            for k, v in agg.items()
        }])
        st.dataframe(agg_df, use_container_width=True)


if __name__ == "__main__":
    main()
