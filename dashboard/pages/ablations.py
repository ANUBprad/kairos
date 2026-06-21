"""Ablation Explorer page."""

from __future__ import annotations

import streamlit as st
import pandas as pd

from intelligence.ablation import AblationComparison
from intelligence.reporting.visualization import plot_ablation_impact

st.set_page_config(page_title="Ablations", page_icon="🔍", layout="wide")
st.title("🔍 Ablation Explorer")


def main() -> None:
    st.warning("No ablation data loaded. Run ablations in `intelligence/ablation` first.")

    if st.checkbox("Show demo data"):
        demo_comparisons = [
            AblationComparison(
                baseline_label="baseline",
                treatment_label="with_rerank",
                total_queries=100,
                recall_delta=0.052,
                precision_delta=0.031,
                latency_delta_ms=15.2,
                success_rate_delta=0.008,
                fallback_rate_delta=-0.015,
            ),
            AblationComparison(
                baseline_label="baseline",
                treatment_label="with_calibration",
                total_queries=100,
                recall_delta=0.023,
                precision_delta=0.018,
                latency_delta_ms=5.1,
                success_rate_delta=0.003,
                fallback_rate_delta=-0.005,
            ),
            AblationComparison(
                baseline_label="baseline",
                treatment_label="with_optimization",
                total_queries=100,
                recall_delta=-0.008,
                precision_delta=0.042,
                latency_delta_ms=-12.0,
                success_rate_delta=0.012,
                fallback_rate_delta=-0.008,
            ),
        ]

        col1, col2 = st.columns([1, 1])
        with col1:
            st.subheader("Ablation Deltas")
            data = []
            for comp in demo_comparisons:
                data.append({
                    "Comparison": f"{comp.treatment_label} vs {comp.baseline_label}",
                    "Recall Δ": f"{comp.recall_delta:+.3f}" if comp.recall_delta is not None else "N/A",
                    "Precision Δ": f"{comp.precision_delta:+.3f}" if comp.precision_delta is not None else "N/A",
                    "Latency Δ (ms)": f"{comp.latency_delta_ms:+.1f}",
                    "Success Δ": f"{comp.success_rate_delta:+.3f}",
                    "Fallback Δ": f"{comp.fallback_rate_delta:+.3f}",
                })
            st.dataframe(pd.DataFrame(data), use_container_width=True)

        with col2:
            st.subheader("Impact Visualization")
            img = plot_ablation_impact(demo_comparisons)
            st.image(img, use_container_width=True)

        st.subheader("Delta by Metric")
        metrics_df = pd.DataFrame([
            {
                "Metric": "Recall",
                "with_rerank": 0.052,
                "with_calibration": 0.023,
                "with_optimization": -0.008,
            },
            {
                "Metric": "Precision",
                "with_rerank": 0.031,
                "with_calibration": 0.018,
                "with_optimization": 0.042,
            },
        ])
        st.bar_chart(metrics_df.set_index("Metric"))


if __name__ == "__main__":
    main()
