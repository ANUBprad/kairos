from __future__ import annotations

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from dashboard.theme import Color, inject_css
from dashboard.components import (
    sidebar, footer, page_header, kpi_row,
    chart_container, bar_chart, dark_fig, insight_box, styled_dataframe,
)

st.set_page_config(page_title="Leaderboard — Kairos", page_icon="🍁", layout="wide")
inject_css()


def premium_leaderboard() -> None:
    st.markdown('<div class="kairos-section-title">Mode Rankings</div>', unsafe_allow_html=True)

    lb_data = [
        {"Rank": "🥇", "Mode": "Kairos Adaptive", "Recall": 0.89, "Precision": 0.85, "MRR": 0.91, "MAP": 0.88, "NDCG": 0.90, "Latency": "163ms", "Cost": "$0.0145", "Composite": 0.89},
        {"Rank": "🥈", "Mode": "Always Multi-Hop", "Recall": 0.80, "Precision": 0.76, "MRR": 0.82, "MAP": 0.79, "NDCG": 0.81, "Latency": "190ms", "Cost": "$0.0220", "Composite": 0.80},
        {"Rank": "🥉", "Mode": "Always Complex", "Recall": 0.78, "Precision": 0.74, "MRR": 0.80, "MAP": 0.77, "NDCG": 0.79, "Latency": "170ms", "Cost": "$0.0184", "Composite": 0.78},
        {"Rank": "4", "Mode": "Always Simple", "Recall": 0.75, "Precision": 0.71, "MRR": 0.77, "MAP": 0.74, "NDCG": 0.76, "Latency": "133ms", "Cost": "$0.0100", "Composite": 0.75},
        {"Rank": "5", "Mode": "Naive RAG", "Recall": 0.72, "Precision": 0.68, "MRR": 0.74, "MAP": 0.71, "NDCG": 0.73, "Latency": "145ms", "Cost": "$0.0123", "Composite": 0.72},
    ]

    st.markdown(
        """
        <style>
        .lb-row { display:flex; align-items:center; padding:0.75rem 0; border-bottom:1px solid """ + Color.BORDER + """; }
        .lb-row:last-child { border-bottom:none; }
        .lb-row .rank { width:40px; font-size:1.25rem; text-align:center; }
        .lb-row .mode { flex:2; font-weight:600; color:""" + Color.TEXT_PRIMARY + """; font-size:0.875rem; }
        .lb-row .stat { flex:1; text-align:center; color:""" + Color.TEXT_SECONDARY + """; font-size:0.8125rem; }
        .lb-row .stat.highlight { color:""" + Color.ORANGE_PRIMARY + """; font-weight:600; }
        .lb-header { display:flex; align-items:center; padding:0.5rem 0; border-bottom:2px solid """ + Color.BORDER + """; }
        .lb-header .hdr { font-size:0.625rem; text-transform:uppercase; letter-spacing:0.06em; color:""" + Color.TEXT_MUTED + """; font-weight:600; }
        .lb-header .hdr:nth-child(1) { width:40px; text-align:center; }
        .lb-header .hdr:nth-child(2) { flex:2; }
        .lb-header .hdr:nth-child(n+3) { flex:1; text-align:center; }
        </style>
        """,
        unsafe_allow_html=True,
    )

    headers = ["", "Mode", "Recall", "Precision", "MRR", "MAP", "NDCG", "Latency", "Cost", "Composite"]
    hdr_html = '<div class="lb-header">'
    for h in headers:
        hdr_html += f'<div class="hdr">{h}</div>'
    hdr_html += "</div>"
    st.markdown(hdr_html, unsafe_allow_html=True)

    for row in lb_data:
        is_top = row["Mode"] == "Kairos Adaptive"
        mode_style = f'color:{Color.ORANGE_PRIMARY}' if is_top else ""
        row_html = f'<div class="lb-row">'
        row_html += f'<div class="rank">{row["Rank"]}</div>'
        row_html += f'<div class="mode" style="{mode_style}">{"⭐ " if is_top else ""}{row["Mode"]}</div>'
        for key in ["Recall", "Precision", "MRR", "MAP", "NDCG"]:
            val = row[key]
            cls = 'stat highlight' if (is_top and val >= 0.85) else 'stat'
            row_html += f'<div class="{cls}">{val:.3f}</div>'
        row_html += f'<div class="stat">{row["Latency"]}</div>'
        row_html += f'<div class="stat{" highlight" if is_top else ""}">{row["Cost"]}</div>'
        row_html += f'<div class="stat highlight">{row["Composite"]}</div>'
        row_html += "</div>"
        st.markdown(row_html, unsafe_allow_html=True)


def main() -> None:
    sidebar()
    page_header("🏆  Leaderboard", "Cross-domain mode rankings with comprehensive performance metrics")

    modes = ["Naive RAG", "Always Simple", "Always Complex", "Always Multi-Hop", "Kairos Adaptive"]
    domains = ["Finance", "Legal", "Healthcare", "Technology", "General"]

    demo_data = {
        "Naive RAG": [0.72, 0.68, 0.74, 0.70, 0.76],
        "Always Simple": [0.75, 0.71, 0.77, 0.73, 0.79],
        "Always Complex": [0.78, 0.74, 0.80, 0.76, 0.81],
        "Always Multi-Hop": [0.80, 0.76, 0.82, 0.78, 0.83],
        "Kairos Adaptive": [0.89, 0.85, 0.91, 0.87, 0.92],
    }

    df = pd.DataFrame(demo_data, index=domains)

    avg_scores = {k: sum(v) / len(v) for k, v in demo_data.items()}
    sorted_modes = sorted(avg_scores, key=avg_scores.get, reverse=True)

    kpi_row([
        {"label": "Modes Compared", "value": str(len(modes))},
        {"label": "Domains", "value": str(len(domains))},
        {"label": "Top Performer", "value": sorted_modes[0]},
        {"label": "Avg Top Score", "value": f"{avg_scores[sorted_modes[0]]:.3f}"},
    ])

    premium_leaderboard()

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Cross-Domain Score Matrix")
        styled_dataframe(df.style.highlight_max(axis=1))

    with col2:
        st.subheader("Performance Heatmap")
        z = df.values
        heat_fig = go.Figure(data=go.Heatmap(
            z=z,
            x=df.columns.tolist(),
            y=df.index.tolist(),
            colorscale=[[0, Color.DARK_BG], [0.5, Color.ORANGE_PRIMARY], [1, "#FF8A50"]],
            hoverongaps=False,
            text=[[f"{v:.3f}" for v in row] for row in z],
            texttemplate="%{text}",
            textfont=dict(size=10, color=Color.TEXT_PRIMARY),
        ))
        heat_fig = dark_fig(heat_fig, 280)
        heat_fig.update_layout(
            xaxis=dict(side="top"),
            yaxis=dict(autorange="reversed"),
        )
        chart_container(heat_fig, "heatmap")

    st.subheader("Average Scores Across All Domains")
    rank_df = pd.DataFrame({
        "Rank": range(1, len(sorted_modes) + 1),
        "Mode": sorted_modes,
        "Average Score": [avg_scores[m] for m in sorted_modes],
    })
    chart = bar_chart(rank_df, x="Mode", y="Average Score", title="", height=280)
    chart_container(chart, "avg_scores")

    insight_box(
        "<strong>🏆 Kairos Adaptive</strong> ranks highest across all domains with an average "
        f"score of <strong>{avg_scores['Kairos Adaptive']:.3f}</strong>, "
        f"outperforming the Naive RAG baseline by "
        f"<strong>{((avg_scores['Kairos Adaptive'] - avg_scores['Naive RAG']) / avg_scores['Naive RAG'] * 100):+.1f}%</strong>."
    )

    footer()


if __name__ == "__main__":
    main()
