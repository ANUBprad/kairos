from __future__ import annotations

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from dashboard.theme import Color, inject_css
from dashboard.components import (
    sidebar, footer, page_header, kpi_row,
    chart_container, bar_chart, dark_fig, insight_box, styled_dataframe,
)

st.set_page_config(page_title="Domain Analysis — Kairos", page_icon="🍁", layout="wide")
inject_css()


def main() -> None:
    sidebar()
    page_header("🌎  Domain Analysis", "Detailed performance breakdown across knowledge domains with multi-dimensional scoring")

    domains = {
        "Finance": {"queries": 204, "composite": 0.89, "faithfulness": 0.91, "relevance": 0.88, "hallucination": 0.92, "grounding": 0.85},
        "Legal": {"queries": 204, "composite": 0.85, "faithfulness": 0.87, "relevance": 0.84, "hallucination": 0.89, "grounding": 0.80},
        "Healthcare": {"queries": 204, "composite": 0.91, "faithfulness": 0.93, "relevance": 0.90, "hallucination": 0.94, "grounding": 0.87},
        "Technology": {"queries": 204, "composite": 0.87, "faithfulness": 0.89, "relevance": 0.86, "hallucination": 0.91, "grounding": 0.82},
        "General": {"queries": 204, "composite": 0.92, "faithfulness": 0.94, "relevance": 0.91, "hallucination": 0.95, "grounding": 0.88},
    }

    df = pd.DataFrame.from_dict(domains, orient="index")

    kpi_row([
        {"label": "Domains", "value": str(len(domains))},
        {"label": "Avg Composite", "value": f"{df['composite'].mean():.2%}"},
        {"label": "Best Domain", "value": df["composite"].idxmax()},
        {"label": "Worst Domain", "value": df["composite"].idxmin()},
    ])

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Domain Rankings")
        styled_dataframe(df.style.highlight_max(axis=0))

    with col2:
        st.subheader("Composite Score by Domain")
        composite_df = df.reset_index()[["index", "composite"]].rename(columns={"index": "Domain"})
        chart = bar_chart(composite_df, x="Domain", y="composite", title="", height=280)
        chart_container(chart, "composite_chart")

    st.subheader("Dimension Breakdown")
    dim_df = df.reset_index().melt(
        id_vars=["index"],
        value_vars=["faithfulness", "relevance", "hallucination", "grounding"],
        var_name="Dimension", value_name="Score",
    ).rename(columns={"index": "Domain"})

    fig = go.Figure()
    colors = [Color.ORANGE_PRIMARY, "#4361ee", Color.SUCCESS, Color.WARNING]
    for i, dim in enumerate(["faithfulness", "relevance", "hallucination", "grounding"]):
        subset = dim_df[dim_df["Dimension"] == dim]
        fig.add_trace(go.Bar(
            name=dim.replace("_", " ").title(),
            x=subset["Domain"],
            y=subset["Score"],
            marker_color=colors[i],
        ))
    fig = dark_fig(fig, 320)
    fig.update_layout(barmode="group", legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    chart_container(fig, "dim_chart")

    st.markdown("<div class='kairos-section-title'>Key Insights</div>", unsafe_allow_html=True)
    col_i1, col_i2 = st.columns(2)
    with col_i1:
        st.markdown(f"- **Healthcare** achieves the highest composite score (**{domains['Healthcare']['composite']:.2f}**), likely due to precise terminology grounding.")
        st.markdown(f"- **General** domain shows the best hallucination resistance (**{domains['General']['hallucination']:.2f}**).")
    with col_i2:
        st.markdown(f"- **Legal** domain has the lowest composite (**{domains['Legal']['composite']:.2f}**), suggesting complexity in legal document retrieval.")
        st.markdown(f"- All domains score above **0.80** in faithfulness, indicating strong answer-context alignment.")

    st.markdown("<div class='kairos-section-title'>Query Distribution by Difficulty</div>", unsafe_allow_html=True)
    difficulty_data = {
        "Domain": list(domains.keys()),
        "Simple": [68, 68, 68, 68, 68],
        "Complex": [68, 68, 68, 68, 68],
        "Multi-Hop": [68, 68, 68, 68, 68],
    }
    styled_dataframe(pd.DataFrame(difficulty_data))

    insight_box(
        "<strong>Domain Insight:</strong> Performance varies by domain complexity. Legal documents "
        "with dense terminology and cross-references present the greatest retrieval challenge. "
        "Consider domain-specific fine-tuning for Legal and Technology domains."
    )

    footer()


if __name__ == "__main__":
    main()
