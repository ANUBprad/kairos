from __future__ import annotations

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from dashboard.theme import Color, inject_css
from dashboard.components import (
    sidebar, footer, page_header, kpi_row,
    chart_container, bar_chart, grouped_bar,
    dark_fig, insight_box, styled_dataframe,
)

st.set_page_config(page_title="Mode Comparisons — Kairos", page_icon="🍁", layout="wide")
inject_css()


def full_comparison_chart(df: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    colors = [Color.ORANGE_PRIMARY, "#4361ee", Color.SUCCESS, Color.WARNING, "#9C27B0", "#00BCD4"]
    metric_cols = [c for c in df.columns]
    tdf = df.T.reset_index()
    tdf.columns = ["Mode"] + metric_cols
    for i, metric in enumerate(metric_cols):
        fig.add_trace(go.Bar(
            name=metric,
            x=tdf["Mode"],
            y=tdf[metric],
            marker_color=colors[i % len(colors)],
        ))
    fig = dark_fig(fig, 350)
    fig.update_layout(
        barmode="group",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1, font=dict(size=10)),
    )
    return fig


def main() -> None:
    sidebar()
    page_header("📊  Mode Comparisons", "Full comparison matrix across all retrieval modes with key performance indicators")

    comparison_data = {
        "Metric": ["Composite Score", "Latency (ms)", "Pass Rate", "Fail Rate", "Success Rate", "Avg Docs Retrieved"],
        "Naive RAG": [0.72, 145, 68, 12, 95, 4.2],
        "Always Simple": [0.75, 133, 72, 10, 96, 3.8],
        "Always Complex": [0.78, 170, 74, 9, 94, 5.1],
        "Always Multi-Hop": [0.80, 190, 76, 8, 93, 5.8],
        "Kairos Adaptive": [0.89, 163, 85, 5, 97, 4.6],
    }
    df = pd.DataFrame(comparison_data).set_index("Metric")

    kpi_row([
        {"label": "Modes Compared", "value": "5"},
        {"label": "Best Composite", "value": "0.89"},
        {"label": "Best Pass Rate", "value": "97%"},
        {"label": "Fastest Mode", "value": "133ms"},
    ])

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("All Modes — Aggregate Comparison")
        styled_dataframe(
            df.style.highlight_max(axis=1, subset=pd.IndexSlice[["Composite Score", "Pass Rate", "Success Rate"], :])
              .highlight_min(axis=1, subset=pd.IndexSlice[["Fail Rate", "Latency (ms)"], :])
        )

    with col2:
        st.subheader("Composite Score Comparison")
        score_df = df.loc[["Composite Score"]].T.reset_index()
        score_df.columns = ["Mode", "Score"]
        chart = bar_chart(score_df, x="Mode", y="Score", title="", height=280)
        chart_container(chart, "composite_comp")

    st.subheader("Full Metric Comparison")
    chart_container(full_comparison_chart(df), "full_comp")

    improvement_data = {
        "Mode": ["Always Simple", "Always Complex", "Always Multi-Hop", "Kairos Adaptive"],
        "Composite Improvement": [4.2, 8.3, 11.1, 23.6],
        "Latency Change": [-8.3, 17.2, 31.0, 12.4],
        "Pass Rate Change": [4, 6, 8, 17],
    }

    st.subheader("Improvement vs Naive RAG Baseline")
    imp_df = pd.DataFrame(improvement_data)
    styled_dataframe(imp_df)

    st.markdown("<div class='kairos-section-title'>Performance Summary</div>", unsafe_allow_html=True)
    st.success(
        "**Kairos Adaptive** achieves the highest composite score (0.89) "
        "with a 23.6% improvement over Naive RAG, while maintaining reasonable "
        "latency (+12.4%) and the best pass rate (85%). "
        "Always Multi-Hop scores higher than Always Simple but at significantly "
        "higher latency cost (+31%)."
    )

    insight_box(
        "<strong>Comparison Insight:</strong> Kairos Adaptive dominates across all quality metrics "
        "while keeping latency and cost in check. Always Simple remains a viable option for "
        "cost-sensitive deployments where some quality trade-off is acceptable."
    )

    footer()


if __name__ == "__main__":
    main()
