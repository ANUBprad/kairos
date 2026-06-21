"""Statistical Analysis page."""

from __future__ import annotations

import streamlit as st
import pandas as pd

from intelligence.statistics import (
    paired_t_test,
    wilcoxon_signed_rank,
    mean_confidence_interval,
    bootstrap_confidence_interval,
    cohens_d,
    cliffs_delta,
)
from intelligence.statistics.reporting import generate_validation_report

st.set_page_config(page_title="Statistics", page_icon="📈", layout="wide")
st.title("📈 Statistical Analysis")


def main() -> None:
    st.info("Run statistical validation on retrieval results.")

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Input Data")
        baseline_str = st.text_area(
            "Baseline scores (comma-separated)",
            "0.75, 0.80, 0.72, 0.78, 0.85, 0.70, 0.82, 0.77, 0.79, 0.83",
        )
        treatment_str = st.text_area(
            "Treatment scores (comma-separated)",
            "0.82, 0.85, 0.79, 0.84, 0.88, 0.76, 0.86, 0.81, 0.83, 0.87",
        )

    if st.button("Run Validation"):
        try:
            baseline = [float(x.strip()) for x in baseline_str.split(",") if x.strip()]
            treatment = [float(x.strip()) for x in treatment_str.split(",") if x.strip()]
        except ValueError:
            st.error("Invalid number format. Use comma-separated floats.")
            return

        if len(baseline) < 3 or len(treatment) < 3:
            st.error("Need at least 3 values per group.")
            return

        report = generate_validation_report(
            baseline, treatment,
            metric_name="recall",
            baseline_label="baseline",
            treatment_label="treatment",
        )

        with col2:
            st.subheader("Summary")
            st.markdown(f"**{report.summary}**")
            st.markdown(f"*Significant:* {'Yes' if report.is_significant else 'No'}")
            st.markdown(f"*Observations:* {report.n_observations}")

        col3, col4 = st.columns(2)

        with col3:
            st.subheader("Significance Tests")
            sig_data = []
            for name, sig in report.significance.items():
                sig_data.append({
                    "Test": name,
                    "Statistic": f"{sig.statistic:.4f}",
                    "p-value": f"{sig.p_value:.4f}",
                    "Significant (α=0.05)": "Yes" if sig.significant else "No",
                })
            st.dataframe(pd.DataFrame(sig_data), use_container_width=True)

        with col4:
            st.subheader("Effect Sizes")
            es_data = []
            for name, es in report.effect_sizes.items():
                es_data.append({
                    "Measure": name,
                    "Value": f"{es.value:.4f}",
                    "Magnitude": es.magnitude,
                    "Direction": es.direction,
                })
            st.dataframe(pd.DataFrame(es_data), use_container_width=True)

        st.subheader("Confidence Intervals (95%)")
        ci_data = []
        for label, ci in report.confidence_intervals.items():
            ci_data.append({
                "Group": label,
                "Mean": f"{ci.mean:.4f}",
                "Std Err": f"{ci.std_err:.4f}",
                "Lower": f"{ci.lower_bound:.4f}",
                "Upper": f"{ci.upper_bound:.4f}",
                "Method": ci.method,
            })
        st.dataframe(pd.DataFrame(ci_data), use_container_width=True)

        if report.bootstrap:
            st.subheader("Bootstrap Evaluation")
            bs = report.bootstrap
            bs_data = pd.DataFrame([{
                "Point Estimate": f"{bs.point_estimate:.4f}",
                "Bias": f"{bs.bias:.4f}",
                "Std Error": f"{bs.std_error:.4f}",
                "95% CI Lower": f"{bs.ci_lower:.4f}",
                "95% CI Upper": f"{bs.ci_upper:.4f}",
                "Resamples": bs.n_resamples,
            }])
            st.dataframe(bs_data, use_container_width=True)


if __name__ == "__main__":
    main()
