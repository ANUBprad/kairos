"""Experiment Explorer page."""

from __future__ import annotations

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd

from intelligence.experiments import ExperimentRegistry, ExperimentRun, ExperimentMetrics, ExperimentStatus
from intelligence.reporting.leaderboard import rank_experiments
from intelligence.reporting.visualization import plot_metric_trend, plot_experiment_comparison


st.set_page_config(page_title="Experiments", page_icon="🧪", layout="wide")
st.title("🧪 Experiment Explorer")


def load_registry() -> ExperimentRegistry:
    try:
        return ExperimentRegistry()
    except Exception:
        return ExperimentRegistry()


def main() -> None:
    registry = load_registry()
    runs = registry.list_runs()

    if not runs:
        st.info("No experiment runs found. Run an experiment first.")
        return

    col1, col2 = st.columns([1, 2])

    with col1:
        st.subheader("Runs")
        run_names = [f"{r.name or r.run_id[:8]} ({r.phase})" for r in runs]
        selected_idx = st.selectbox("Select run", range(len(runs)), format_func=lambda i: run_names[i])
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
        metric = st.selectbox("Metric", ["recall", "precision", "latency_ms"])
        img_bytes = plot_metric_trend(runs, metric=metric)
        st.image(img_bytes, use_container_width=True)

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
        st.image(img_bytes2, use_container_width=True)


if __name__ == "__main__":
    main()
