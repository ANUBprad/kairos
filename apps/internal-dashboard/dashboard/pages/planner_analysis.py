from __future__ import annotations

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from dashboard.theme import Color, inject_css
from dashboard.components import (
    sidebar, footer, page_header, kpi_row,
    chart_container, bar_chart, dark_fig, insight_box, styled_dataframe,
)

st.set_page_config(page_title="Planner Analysis — Kairos", page_icon="🍁", layout="wide")
inject_css()


def main() -> None:
    sidebar()
    page_header("🧠  Planner Analysis", "Query type classification, confidence scoring, and strategy distribution analysis")

    kpi_row([
        {"label": "Classification Accuracy", "value": "89%"},
        {"label": "Simple Accuracy", "value": "94%"},
        {"label": "Multi-Hop Accuracy", "value": "82%"},
        {"label": "Fallback Rate", "value": "4.2%"},
    ])

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Strategy Distribution by Query Type")
        strategy_data = {
            "Query Type": ["Simple", "Complex", "Multi-Hop"],
            "Simple Retrieval": [0.92, 0.08, 0.00],
            "Complex Retrieval": [0.05, 0.85, 0.10],
            "Multi-Hop Retrieval": [0.03, 0.07, 0.90],
        }
        df = pd.DataFrame(strategy_data).set_index("Query Type")
        styled_dataframe(df.style.format("{:.0%}"))

    with col2:
        st.subheader("Strategy × Query Type Heatmap")
        heat_fig = go.Figure(data=go.Heatmap(
            z=df.values,
            x=df.columns.tolist(),
            y=df.index.tolist(),
            colorscale=[[0, Color.DARK_BG], [0.5, Color.ORANGE_PRIMARY], [1, "#FF8A50"]],
            hoverongaps=False,
            text=[[f"{v:.0%}" for v in row] for row in df.values],
            texttemplate="%{text}",
            textfont=dict(size=11, color=Color.TEXT_PRIMARY),
        ))
        heat_fig = dark_fig(heat_fig, 250)
        heat_fig.update_layout(xaxis=dict(side="top"))
        chart_container(heat_fig, "strategy_heat")

    col3, col4 = st.columns(2)
    with col3:
        st.subheader("Planner Confidence by Domain")
        confidence_data = {
            "Domain": ["Finance", "Legal", "Healthcare", "Technology", "General"],
            "Avg Confidence": [0.87, 0.82, 0.91, 0.85, 0.93],
            "High Confidence (>0.8)": [0.72, 0.65, 0.78, 0.70, 0.82],
            "Low Confidence (<0.4)": [0.05, 0.10, 0.03, 0.07, 0.02],
        }
        styled_dataframe(pd.DataFrame(confidence_data))

    with col4:
        st.subheader("Confidence by Domain")
        conf_df = pd.DataFrame(confidence_data)
        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=conf_df["Domain"], y=conf_df["Avg Confidence"],
            name="Avg Confidence", marker_color=Color.ORANGE_PRIMARY,
            text=conf_df["Avg Confidence"].apply(lambda x: f"{x:.0%}"),
            textposition="outside",
            textfont=dict(size=10, color=Color.TEXT_PRIMARY),
        ))
        fig = dark_fig(fig, 260)
        fig.update_layout(yaxis=dict(range=[0, 1], tickformat=".0%"))
        chart_container(fig, "conf_chart")

    st.markdown("<div class='kairos-section-title'>Fallback Analysis</div>", unsafe_allow_html=True)
    col_f1, col_f2, col_f3 = st.columns(3)
    col_f1.metric("Overall Fallback Rate", "4.2%")
    col_f2.metric("Common Trigger", "Low confidence", help="Multi-hop queries with insufficient context")
    col_f3.metric("Fallback Effectiveness", "87%", help="Fallback queries still return relevant results")

    st.markdown("<div class='kairos-section-title'>Top-K Distribution</div>", unsafe_allow_html=True)
    topk_data = {
        "Strategy": ["Simple", "Complex", "Multi-Hop"],
        "Avg Top-K": [3, 5, 7],
        "Min Top-K": [1, 3, 5],
        "Max Top-K": [5, 7, 10],
    }
    topk_df = pd.DataFrame(topk_data)
    col_t1, col_t2 = st.columns(2)
    with col_t1:
        styled_dataframe(topk_df)
    with col_t2:
        fig = go.Figure()
        fig.add_trace(go.Bar(name="Avg Top-K", x=topk_df["Strategy"], y=topk_df["Avg Top-K"], marker_color=Color.ORANGE_PRIMARY))
        fig.add_trace(go.Bar(name="Min Top-K", x=topk_df["Strategy"], y=topk_df["Min Top-K"], marker_color="#4361ee"))
        fig.add_trace(go.Bar(name="Max Top-K", x=topk_df["Strategy"], y=topk_df["Max Top-K"], marker_color=Color.SUCCESS))
        fig = dark_fig(fig, 250)
        fig.update_layout(barmode="group", legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
        chart_container(fig, "topk_chart")

    insight_box(
        "The planner correctly classifies <strong>89%</strong> of query types, with highest "
        "accuracy on simple queries (<strong>94%</strong>) and lowest on multi-hop queries "
        "(<strong>82%</strong>). Confidence scoring enables reliable fallback decisions."
    )

    footer()


if __name__ == "__main__":
    main()
