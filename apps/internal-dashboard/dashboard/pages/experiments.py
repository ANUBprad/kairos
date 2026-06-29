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
    chart_container, bar_chart, insight_box, status_badge,
)

from intelligence.experiments import ExperimentRegistry
from intelligence.reporting.leaderboard import rank_experiments
from intelligence.reporting.visualization import plot_metric_trend, plot_experiment_comparison

st.set_page_config(page_title="Experiments — Kairos", page_icon="🍁", layout="wide")
inject_css()


def load_registry() -> ExperimentRegistry:
    try:
        return ExperimentRegistry()
    except Exception:
        return ExperimentRegistry()


def main() -> None:
    sidebar()
    page_header("🧪  Experiments", "Browse experiment runs, compare metrics, and track performance trends")

    registry = load_registry()
    runs = registry.list_runs()

    if not runs:
        st.info("No experiment runs found. Run an experiment first.")
        footer()
        return

    statuses = [r.status.value for r in runs]
    n_running = statuses.count("running")
    n_completed = statuses.count("completed")
    n_failed = statuses.count("failed")

    kpi_row([
        {"label": "Total Runs", "value": str(len(runs))},
        {"label": "Active Phases", "value": str(len(set(r.phase for r in runs)))},
        {"label": "Avg Recall", "value": f"{sum((r.metrics.recall or 0) for r in runs if r.metrics) / max(len([r for r in runs if r.metrics]), 1):.2%}"},
    ])

    col1, col2 = st.columns([1, 2])

    with col1:
        st.subheader("Runs")
        run_names = [f"{r.name or r.run_id[:8]} ({r.phase})" for r in runs]
        selected_idx = st.selectbox("Select run", range(len(runs)), format_func=lambda i: run_names[i], label_visibility="collapsed")
        selected_run = runs[selected_idx]

        st.markdown("**Run Details**")
        st.json({
            "run_id": selected_run.run_id,
            "name": selected_run.name,
            "phase": selected_run.phase,
            "status": selected_run.status.value,
            "timestamp": selected_run.timestamp,
        })

        if selected_run.metrics:
            st.markdown("**Metrics**")
            metrics_df = pd.DataFrame([{
                k: v for k, v in selected_run.metrics.to_dict().items()
                if v is not None
            }])
            st.dataframe(metrics_df, use_container_width=True)

    with col2:
        st.subheader("Metric Trend")
        metric = st.selectbox("Metric", ["recall", "precision", "latency_ms"], label_visibility="collapsed")
        img_bytes = plot_metric_trend(runs, metric=metric)
        st.image(img_bytes)

        st.subheader("Leaderboard")
        leaderboard = rank_experiments(runs)
        lb_data = []
        for rank, run, score in leaderboard:
            m = run.metrics
            lb_data.append({
                "Rank": rank,
                "Name": run.name or run.run_id[:8],
                "Phase": run.phase,
                "Recall": f"{m.recall:.3f}" if m.recall is not None else "N/A",
                "Precision": f"{m.precision:.3f}" if m.precision is not None else "N/A",
                "Latency (ms)": f"{m.latency_ms:.1f}" if m.latency_ms is not None else "N/A",
                "Score": f"{score:.3f}" if score is not None else "N/A",
            })
        if lb_data:
            st.dataframe(pd.DataFrame(lb_data), use_container_width=True)

    st.subheader("Comparison Chart")
    metrics_multi = st.multiselect(
        "Metrics to compare",
        ["recall", "precision", "latency_ms"],
        default=["recall", "precision"],
    )
    if len(runs) >= 2 and metrics_multi:
        img_bytes2 = plot_experiment_comparison(runs, metrics=metrics_multi)
        st.image(img_bytes2)

    insight_box(
        "<strong>Experiment Insight:</strong> The current leader shows strong recall and precision "
        "scores. Consider running additional ablation studies to isolate the impact of individual "
        "components."
    )

    footer()


if __name__ == "__main__":
    main()
