"""Observability Dashboard page."""

from __future__ import annotations

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from intelligence.observability import (
    PerformanceMonitor, PerformanceSnapshot,
    get_monitor, get_logger, get_alert_manager, get_metrics_registry,
    DashboardMetricsCollector,
)
from intelligence.observability.alerting import (
    LatencyAlertRule, FailureRateAlertRule, DegradedRecallAlertRule,
    AlertSeverity,
)

st.set_page_config(page_title="Observability", page_icon="📡", layout="wide")
st.title("📡 Observability Dashboard")


def main() -> None:
    monitor = get_monitor()
    logger = get_logger()
    alert_manager = get_alert_manager()
    registry = get_metrics_registry()

    collector = DashboardMetricsCollector(
        monitor=monitor,
        logger=logger,
        registry=registry,
        alert_manager=alert_manager,
    )

    col1, col2, col3, col4 = st.columns(4)
    overview = collector.collect_system_overview()

    perf = overview["performance"]
    lat = overview["latency"]

    with col1:
        st.metric("Total Requests", perf["total_requests"])
    with col2:
        st.metric("Success Rate", f"{perf['success_rate']:.1%}")
    with col3:
        st.metric("Throughput", f"{perf['throughput_rps']:.1f} req/s")
    with col4:
        st.metric("P95 Latency", f"{lat['p95_ms']:.0f} ms")

    col5, col6 = st.columns(2)

    with col5:
        st.subheader("Latency Distribution")
        latency_df = pd.DataFrame([{
            "Metric": "p50",
            "ms": lat["p50_ms"],
        }, {
            "Metric": "p95",
            "ms": lat["p95_ms"],
        }, {
            "Metric": "p99",
            "ms": lat["p99_ms"],
        }, {
            "Metric": "Mean",
            "ms": lat["mean_ms"],
        }])
        fig = go.Figure(data=[
            go.Bar(x=latency_df["Metric"], y=latency_df["ms"], marker_color="#4361ee"),
        ])
        fig.update_layout(title="Latency Percentiles (ms)", height=300)
        st.plotly_chart(fig, use_container_width=True)

    with col6:
        st.subheader("Alerts")
        alerts = overview["alerts"]
        st.metric("Total Alerts", alerts["total"])
        st.metric("Critical", alerts["critical"])
        st.metric("Warning", alerts["warning"])
        if alerts["recent"]:
            st.dataframe(pd.DataFrame(alerts["recent"]), use_container_width=True)
        else:
            st.success("No recent alerts")

    st.subheader("Configure Alert Rules")
    col_alert1, col_alert2, col_alert3 = st.columns(3)

    with col_alert1:
        latency_threshold = st.slider("Latency P95 threshold (ms)", 500, 5000, 2000)
        if st.button("Add Latency Alert"):
            alert_manager.add_rule(LatencyAlertRule(threshold_ms=float(latency_threshold)))
            st.success(f"Latency alert added (>{latency_threshold}ms)")

    with col_alert2:
        failure_threshold = st.slider("Failure rate threshold", 0.01, 0.50, 0.10, 0.01)
        if st.button("Add Failure Alert"):
            alert_manager.add_rule(FailureRateAlertRule(threshold=failure_threshold))
            st.success(f"Failure alert added (>{failure_threshold:.0%})")

    with col_alert3:
        recall_threshold = st.slider("Recall threshold", 0.1, 1.0, 0.5, 0.05)
        if st.button("Add Recall Alert"):
            alert_manager.add_rule(DegradedRecallAlertRule(threshold=recall_threshold))
            st.success(f"Recall alert added (<{recall_threshold:.0%})")

    st.subheader("Simulate Request")
    sim_col1, sim_col2, sim_col3 = st.columns(3)
    with sim_col1:
        sim_latency = st.slider("Simulated latency (ms)", 10, 5000, 150)
    with sim_col2:
        sim_success = st.checkbox("Success", True)
    with sim_col3:
        if st.button("Record Request"):
            monitor.record_request(sim_latency, sim_success)
            registry.increment("requests_total", {"status": "ok" if sim_success else "error"})
            logger.log(
                event_type="retrieval",
                source="dashboard",
                attributes={"latency_ms": sim_latency, "success": sim_success},
            )
            st.success(f"Recorded request: {sim_latency}ms, {'success' if sim_success else 'failure'}")

            # Check alerts
            snap = monitor.snapshot()
            alerts_fired = alert_manager.check_all(
                latency_snapshot=snap.latency,
                failure_rate=snap.failure_rate,
                recall=0.75,
            )
            if alerts_fired:
                for a in alerts_fired:
                    st.warning(f"ALERT: {a.message}")


if __name__ == "__main__":
    main()
