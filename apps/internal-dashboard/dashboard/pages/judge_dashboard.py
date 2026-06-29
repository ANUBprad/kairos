from __future__ import annotations

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from dashboard.theme import Color, inject_css
from dashboard.components import (
    sidebar, footer, page_header, kpi_row,
    chart_container, dark_fig, insight_box, styled_dataframe,
)

st.set_page_config(page_title="Judge Dashboard — Kairos", page_icon="🍁", layout="wide")
inject_css()


def radar_chart(df_scores: pd.DataFrame) -> go.Figure:
    categories = ["Faithfulness", "Relevance", "Hallucination Resistance", "Grounding"]
    fig = go.Figure()
    colors = [Color.ORANGE_PRIMARY, "#4361ee", Color.SUCCESS, Color.WARNING, "#9C27B0"]
    for i, (_, row) in enumerate(df_scores.iterrows()):
        fig.add_trace(go.Scatterpolar(
            r=[row["Faithfulness"], row["Relevance"], row["Hallucination Resistance"], row["Grounding"]],
            theta=categories,
            fill="toself",
            name=row["Domain"],
            marker_color=colors[i % len(colors)],
            opacity=0.7,
        ))
    fig.update_layout(
        title="",
        height=380,
        margin=dict(l=60, r=60, t=20, b=40),
        paper_bgcolor="rgba(0,0,0,0)",
        font=dict(color=Color.TEXT_SECONDARY, size=10, family="Inter, sans-serif"),
        polar=dict(
            bgcolor="rgba(0,0,0,0)",
            radialaxis=dict(visible=True, range=[0.7, 1.0], gridcolor=Color.BORDER),
            angularaxis=dict(gridcolor=Color.BORDER),
        ),
        legend=dict(orientation="h", yanchor="bottom", y=1.08, xanchor="right", x=1, font=dict(size=10)),
    )
    return fig


def main() -> None:
    sidebar()
    page_header("⚖  Judge Dashboard", "Multi-dimensional quality evaluation across domains by LLM-as-a-judge")

    score_data = {
        "Domain": ["Finance", "Legal", "Healthcare", "Technology", "General"],
        "Faithfulness": [0.91, 0.87, 0.93, 0.89, 0.94],
        "Relevance": [0.88, 0.84, 0.90, 0.86, 0.91],
        "Hallucination Resistance": [0.92, 0.89, 0.94, 0.91, 0.95],
        "Grounding": [0.85, 0.80, 0.87, 0.82, 0.88],
        "Composite": [0.89, 0.85, 0.91, 0.87, 0.92],
    }
    df_scores = pd.DataFrame(score_data)

    kpi_row([
        {"label": "Domains", "value": str(len(df_scores))},
        {"label": "Avg Composite", "value": f"{df_scores['Composite'].mean():.2%}"},
        {"label": "Best Domain", "value": df_scores.loc[df_scores['Composite'].idxmax(), "Domain"]},
        {"label": "Worst Domain", "value": df_scores.loc[df_scores['Composite'].idxmin(), "Domain"]},
    ])

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Dimension Scores by Domain")
        styled_dataframe(df_scores.style.highlight_max(axis=0))

    with col2:
        st.subheader("Radar Overview")
        fig = radar_chart(df_scores)
        chart_container(fig, "radar")

    col3, col4 = st.columns(2)
    with col3:
        st.subheader("Judgment Distribution")
        judgment_data = {
            "Domain": ["Finance", "Legal", "Healthcare", "Technology", "General"],
            "Pass %": [82, 76, 88, 80, 91],
            "Warn %": [12, 16, 8, 13, 6],
            "Fail %": [6, 8, 4, 7, 3],
        }
        styled_dataframe(pd.DataFrame(judgment_data))

    with col4:
        st.subheader("Pass Rate by Domain")
        jd_df = pd.DataFrame(judgment_data)
        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=jd_df["Domain"], y=jd_df["Pass %"],
            marker_color=Color.ORANGE_PRIMARY,
            text=jd_df["Pass %"].apply(lambda x: f"{x}%"),
            textposition="outside",
            textfont=dict(size=10, color=Color.TEXT_PRIMARY),
        ))
        fig.add_trace(go.Bar(x=jd_df["Domain"], y=jd_df["Warn %"], marker_color=Color.WARNING, name="Warn"))
        fig.add_trace(go.Bar(x=jd_df["Domain"], y=jd_df["Fail %"], marker_color=Color.ERROR, name="Fail"))
        fig = dark_fig(fig, 260)
        fig.update_layout(barmode="stack", legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
        chart_container(fig, "pass_rate")

    st.subheader("Dimension Weight Configuration")
    weight_data = {
        "Dimension": ["Faithfulness", "Relevance", "Hallucination", "Grounding"],
        "Weight": [1.0, 1.0, 1.5, 1.0],
        "Rationale": [
            "Core measure of answer truthfulness",
            "Ensures answers address the query",
            "Critical for research validity — double weight",
            "Verifies answers cite supporting evidence",
        ],
    }
    styled_dataframe(pd.DataFrame(weight_data))

    insight_box(
        "<strong>Judge Insight:</strong> Hallucination resistance is weighted <strong>1.5x</strong> "
        "because preventing unsupported claims is the highest priority for retrieval quality. "
        "All domains score above 0.80 across all dimensions."
    )

    footer()


if __name__ == "__main__":
    main()
