from __future__ import annotations

import streamlit as st
import pandas as pd

st.set_page_config(page_title="Judge Dashboard", page_icon="⚖️", layout="wide")
st.title("⚖️ LLM Judge Scores")


def main() -> None:
    st.markdown("### Dimension Scores by Domain (Kairos Adaptive)")

    score_data = {
        "Domain": ["Finance", "Legal", "Healthcare", "Technology", "General"],
        "Faithfulness": [0.91, 0.87, 0.93, 0.89, 0.94],
        "Relevance": [0.88, 0.84, 0.90, 0.86, 0.91],
        "Hallucination Resistance": [0.92, 0.89, 0.94, 0.91, 0.95],
        "Grounding": [0.85, 0.80, 0.87, 0.82, 0.88],
        "Composite": [0.89, 0.85, 0.91, 0.87, 0.92],
    }
    df = pd.DataFrame(score_data)
    st.dataframe(df.style.highlight_max(axis=0), use_container_width=True)

    st.markdown("### Judgment Distribution")
    judgment_data = {
        "Domain": ["Finance", "Legal", "Healthcare", "Technology", "General"],
        "Pass %": [82, 76, 88, 80, 91],
        "Warn %": [12, 16, 8, 13, 6],
        "Fail %": [6, 8, 4, 7, 3],
    }
    st.dataframe(pd.DataFrame(judgment_data), use_container_width=True)

    st.markdown("### Dimension Weight Configuration")
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
    st.dataframe(pd.DataFrame(weight_data), use_container_width=True)

    st.info(
        "Hallucination resistance is weighted 1.5x because preventing "
        "unsupported claims is the highest priority for retrieval quality."
    )


if __name__ == "__main__":
    main()
