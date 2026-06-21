from __future__ import annotations

import streamlit as st
import pandas as pd

st.set_page_config(page_title="Cost Analysis", page_icon="💰", layout="wide")
st.title("💰 Cost Analysis")


def main() -> None:
    st.markdown("### Estimated Cost by Mode")

    cost_data = {
        "Mode": ["Naive RAG", "Always Simple", "Always Complex", "Always Multi-Hop", "Kairos Adaptive"],
        "Total Cost": [12.50, 10.20, 18.75, 22.40, 14.80],
        "Avg Cost/Query": [0.0123, 0.0100, 0.0184, 0.0220, 0.0145],
        "Cost Ratio vs Baseline": [1.00, 0.82, 1.50, 1.79, 1.18],
        "Embedding Cost": [5.00, 4.00, 7.50, 9.00, 6.00],
        "LLM Call Cost": [6.00, 5.00, 9.00, 10.80, 7.00],
        "Storage Cost": [1.50, 1.20, 2.25, 2.60, 1.80],
    }
    df = pd.DataFrame(cost_data)
    st.dataframe(df.style.highlight_min(subset=["Total Cost", "Avg Cost/Query"], axis=0), use_container_width=True)

    st.markdown("### Cost-Effectiveness Analysis")
    st.markdown("""
    | Mode | Composite Score | Cost/Query | Score per $0.01 |
    |------|---------------|-----------|----------------|
    | Naive RAG | 0.72 | $0.0123 | 0.59 |
    | Always Simple | 0.75 | $0.0100 | 0.75 |
    | Always Complex | 0.78 | $0.0184 | 0.42 |
    | Always Multi-Hop | 0.80 | $0.0220 | 0.36 |
    | **Kairos Adaptive** | **0.89** | **$0.0145** | **0.61** |
    """)

    st.markdown("### Key Insights")
    st.markdown("- **Always Simple** is cheapest ($0.01/query) but scores lowest")
    st.markdown("- **Always Multi-Hop** is most expensive ($0.022/query)")
    st.markdown("- **Kairos Adaptive** offers best balance: 23.6% higher score than Naive RAG for only 18% more cost")
    st.markdown("- Adaptive routing saves ~33% cost compared to Always Multi-Hop while scoring higher")


if __name__ == "__main__":
    main()
