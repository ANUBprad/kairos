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

from intelligence.ablation import AblationComparison
from intelligence.reporting.visualization import plot_ablation_impact

st.set_page_config(page_title="Ablations — Kairos", page_icon="🍁", layout="wide")
inject_css()


def main() -> None:
    sidebar()
    page_header("🔬  Ablations", "Analyze feature contributions and performance deltas across configurations")

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

        kpi_row([
            {"label": "Comparisons", "value": str(len(demo_comparisons))},
            {"label": "Best Recall Δ", "value": f"{max(c.recall_delta for c in demo_comparisons):+.1%}"},
            {"label": "Best Precision Δ", "value": f"{max(c.precision_delta for c in demo_comparisons):+.1%}"},
            {"label": "Avg Latency Δ", "value": f"{sum(c.latency_delta_ms for c in demo_comparisons) / len(demo_comparisons):+.0f}ms"},
        ])

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
            styled_dataframe(pd.DataFrame(data))

        with col2:
            st.subheader("Impact Visualization")
            img = plot_ablation_impact(demo_comparisons)
            st.image(img)

        st.subheader("Delta by Metric")
        metrics_df = pd.DataFrame([
            {"Metric": "Recall", "with_rerank": 0.052, "with_calibration": 0.023, "with_optimization": -0.008},
            {"Metric": "Precision", "with_rerank": 0.031, "with_calibration": 0.018, "with_optimization": 0.042},
        ])
        st.bar_chart(metrics_df.set_index("Metric"))

        insight_box(
            "<strong>Ablation Insight:</strong> Re-ranking provides the largest recall improvement "
            "(+5.2%), while optimization reduces latency by 12ms. Calibration offers balanced "
            "improvements across all metrics with minimal latency overhead."
        )

    footer()


if __name__ == "__main__":
    main()
