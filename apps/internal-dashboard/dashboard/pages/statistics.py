from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from dashboard.theme import Color, inject_css
from dashboard.components import (
    sidebar, footer, page_header, kpi_row,
    chart_container, dark_fig, insight_box, styled_dataframe,
)

from intelligence.statistics import (
    paired_t_test,
    wilcoxon_signed_rank,
    mean_confidence_interval,
    bootstrap_confidence_interval,
    cohens_d,
    cliffs_delta,
)
from intelligence.statistics.reporting import generate_validation_report

st.set_page_config(page_title="Statistics — Kairos", page_icon="🍁", layout="wide")
inject_css()


def plot_distribution(baseline: list[float], treatment: list[float]) -> go.Figure:
    fig = go.Figure()
    fig.add_trace(go.Violin(
        y=baseline, name="Baseline",
        box_visible=True, meanline_visible=True,
        line_color=Color.ORANGE_PRIMARY,
        fillcolor="rgba(255,90,10,0.15)",
    ))
    fig.add_trace(go.Violin(
        y=treatment, name="Treatment",
        box_visible=True, meanline_visible=True,
        line_color="#4361ee",
        fillcolor="rgba(67,97,238,0.15)",
    ))
    fig.update_layout(
        title="Score Distribution",
        height=300,
        margin=dict(l=40, r=20, t=40, b=40),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=Color.TEXT_SECONDARY, size=11, family="Inter, sans-serif"),
        yaxis=dict(gridcolor=Color.BORDER),
        xaxis=dict(gridcolor=Color.BORDER),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1, font=dict(size=10)),
    )
    return fig


def main() -> None:
    sidebar()
    page_header("📈  Statistics", "Run statistical validation on retrieval results with significance tests and effect sizes")

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Input Data")
        baseline_str = st.text_area(
            "Baseline scores (comma-separated)",
            "0.75, 0.80, 0.72, 0.78, 0.85, 0.70, 0.82, 0.77, 0.79, 0.83",
        )
        treatment_str = st.text_area(
            "Treatment scores (comma-separated)",
            "0.82, 0.85, 0.79, 0.84, 0.88, 0.76, 0.86, 0.81, 0.83, 0.87",
        )

    if st.button("Run Validation", type="primary"):
        try:
            baseline = [float(x.strip()) for x in baseline_str.split(",") if x.strip()]
            treatment = [float(x.strip()) for x in treatment_str.split(",") if x.strip()]
        except ValueError:
            st.error("Invalid number format. Use comma-separated floats.")
            return

        if len(baseline) < 3 or len(treatment) < 3:
            st.error("Need at least 3 values per group.")
            return

        report = generate_validation_report(
            baseline, treatment,
            metric_name="recall",
            baseline_label="baseline",
            treatment_label="treatment",
        )

        kpi_row([
            {"label": "Is Significant", "value": "Yes" if report.is_significant else "No"},
            {"label": "Observations", "value": str(report.n_observations)},
            {"label": "Summary", "value": report.summary.split(":")[0] if ":" in report.summary else report.summary[:20]},
        ])

        with col2:
            st.subheader("Summary")
            st.markdown(f"**{report.summary}**")
            st.markdown(f"*Significant:* {'Yes' if report.is_significant else 'No'}")
            st.markdown(f"*Observations:* {report.n_observations}")

        chart_container(plot_distribution(baseline, treatment), "dist_plot")

        col3, col4 = st.columns(2)
        with col3:
            st.subheader("Significance Tests")
            sig_data = []
            for name, sig in report.significance.items():
                sig_data.append({
                    "Test": name,
                    "Statistic": f"{sig.statistic:.4f}",
                    "p-value": f"{sig.p_value:.4f}",
                    "Significant (α=0.05)": "Yes" if sig.significant else "No",
                })
            styled_dataframe(pd.DataFrame(sig_data))

        with col4:
            st.subheader("Effect Sizes")
            es_data = []
            for name, es in report.effect_sizes.items():
                es_data.append({
                    "Measure": name,
                    "Value": f"{es.value:.4f}",
                    "Magnitude": es.magnitude,
                    "Direction": es.direction,
                })
            styled_dataframe(pd.DataFrame(es_data))

        st.subheader("Confidence Intervals (95%)")
        ci_data = []
        for label, ci in report.confidence_intervals.items():
            ci_data.append({
                "Group": label,
                "Mean": f"{ci.mean:.4f}",
                "Std Err": f"{ci.std_err:.4f}",
                "Lower": f"{ci.lower_bound:.4f}",
                "Upper": f"{ci.upper_bound:.4f}",
                "Method": ci.method,
            })
        styled_dataframe(pd.DataFrame(ci_data))

        if report.bootstrap:
            st.subheader("Bootstrap Evaluation")
            bs = report.bootstrap
            bs_data = pd.DataFrame([{
                "Point Estimate": f"{bs.point_estimate:.4f}",
                "Bias": f"{bs.bias:.4f}",
                "Std Error": f"{bs.std_error:.4f}",
                "95% CI Lower": f"{bs.ci_lower:.4f}",
                "95% CI Upper": f"{bs.ci_upper:.4f}",
                "Resamples": bs.n_resamples,
            }])
            styled_dataframe(bs_data)

        insight_box(
            "<strong>Statistical Insight:</strong> A significant p-value indicates the treatment "
            "effect is unlikely due to chance. Cohen's d helps interpret the practical significance — "
            "values above 0.8 represent large effects."
        )

    footer()


if __name__ == "__main__":
    main()
