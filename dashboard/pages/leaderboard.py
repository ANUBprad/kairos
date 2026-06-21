from __future__ import annotations

import streamlit as st
import pandas as pd

st.set_page_config(page_title="Leaderboard", page_icon="🏆", layout="wide")
st.title("🏆 Mode Leaderboard")


def main() -> None:
    st.markdown("### Cross-Domain Mode Rankings")

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
    st.dataframe(df.style.highlight_max(axis=1), use_container_width=True)

    st.markdown("### Average Scores Across All Domains")
    avg_scores = {k: sum(v) / len(v) for k, v in demo_data.items()}
    sorted_modes = sorted(avg_scores, key=avg_scores.get, reverse=True)
    rank_df = pd.DataFrame({
        "Rank": range(1, len(sorted_modes) + 1),
        "Mode": sorted_modes,
        "Average Score": [avg_scores[m] for m in sorted_modes],
    })
    st.dataframe(rank_df, use_container_width=True)

    st.info(
        "**Kairos Adaptive** ranks highest across all domains with an average "
        f"score of **{avg_scores['Kairos Adaptive']:.3f}**, "
        f"outperforming the Naive RAG baseline by "
        f"**{((avg_scores['Kairos Adaptive'] - avg_scores['Naive RAG']) / avg_scores['Naive RAG'] * 100):+.1f}%**."
    )


if __name__ == "__main__":
    main()
