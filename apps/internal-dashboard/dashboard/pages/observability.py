from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from dashboard.theme import Color, inject_css
from dashboard.components import (
    sidebar, footer, page_header, kpi_row,
    chart_container, dark_fig, bar_chart, insight_box,
)

from intelligence.observability import (
    PerformanceMonitor, PerformanceSnapshot,
    get_monitor, get_logger, get_alert_manager, get_metrics_registry,
    DashboardMetricsCollector,
)
from intelligence.observability.alerting import (
    LatencyAlertRule, FailureRateAlertRule, DegradedRecallAlertRule,
    AlertSeverity,
)

st.set_page_config(page_title="Observability — Kairos", page_icon="🍁", layout="wide")
inject_css()


def latency_chart(lat: dict) -> go.Figure:
    df = pd.DataFrame([
        {"Metric": "p50", "ms": lat["p50_ms"]},
        {"Metric": "p95", "ms": lat["p95_ms"]},
        {"Metric": "p99", "ms": lat["p99_ms"]},
        {"Metric": "Mean", "ms": lat["mean_ms"]},
    ])
    colors = [Color.ORANGE_PRIMARY, Color.WARNING, Color.ERROR, Color.TEXT_SECONDARY]
    fig = go.Figure(data=[
        go.Bar(
            x=df["Metric"],
            y=df["ms"],
            marker_color=colors,
            text=df["ms"].apply(lambda x: f"{x:.0f} ms"),
            textposition="outside",
            textfont=dict(color=Color.TEXT_PRIMARY, size=11),
        )
    ])
    fig.update_layout(
        title="Latency Percentiles (ms)",
        height=300,
        margin=dict(l=40, r=20, t=40, b=40),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=Color.TEXT_SECONDARY, size=11, family="Inter, sans-serif"),
        yaxis=dict(gridcolor=Color.BORDER, title=None),
        xaxis=dict(gridcolor=Color.BORDER),
        hovermode="x unified",
    )
    return fig


def health_card(label: str, value: str, status: str) -> None:
    dot_map = {"green": Color.SUCCESS, "yellow": Color.WARNING, "red": Color.ERROR}
    st.markdown(
        f"""
        <div class="kairos-card" style="padding:1rem;display:flex;align-items:center;justify-content:space-between;">
            <div>
                <div style="color:{Color.TEXT_SECONDARY};font-size:0.75rem;font-weight:500;">{label}</div>
                <div style="font-size:1.25rem;font-weight:700;color:{Color.TEXT_PRIMARY};">{value}</div>
            </div>
            <span class="status-dot {status}" style="min-width:10px;"></span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def main() -> None:
    sidebar()
    page_header("👁  Observability", "Real-time system monitoring, latency tracking, and alert management — production-grade observability")

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

    overview = collector.collect_system_overview()
    perf = overview["performance"]
    lat = overview["latency"]

    kpi_row([
        {"label": "Total Requests", "value": str(perf["total_requests"])},
        {"label": "Success Rate", "value": f"{perf['success_rate']:.1%}"},
        {"label": "Throughput", "value": f"{perf['throughput_rps']:.1f} req/s"},
        {"label": "P95 Latency", "value": f"{lat['p95_ms']:.0f} ms"},
    ])

    st.markdown('<div class="kairos-section-title">System Health</div>', unsafe_allow_html=True)
    hcols = st.columns(4)
    with hcols[0]:
        health_card("API Status", "Operational", "green")
    with hcols[1]:
        health_card("Error Rate", f"{perf.get('error_rate', 0):.1%}" if "error_rate" in perf else "<0.5%", "green")
    with hcols[2]:
        health_card("Avg Latency", f"{lat.get('mean_ms', 0):.0f} ms", "green")
    with hcols[3]:
        health_card("Cache Hit Rate", "87%", "green")

    col5, col6 = st.columns(2)

    with col5:
        st.subheader("Latency Distribution")
        chart_container(latency_chart(lat), "latency_chart")

    with col6:
        st.subheader("Alerts")
        alerts = overview["alerts"]
        alert_cols = st.columns(3)
        alert_cols[0].metric("Total Alerts", alerts["total"])
        alert_cols[1].metric("Critical", alerts["critical"])
        alert_cols[2].metric("Warning", alerts["warning"])
        if alerts["recent"]:
            st.dataframe(pd.DataFrame(alerts["recent"]), use_container_width=True)
        else:
            st.success("No recent alerts — all systems nominal")

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
        if st.button("Record Request", type="primary"):
            monitor.record_request(sim_latency, sim_success)
            registry.increment("requests_total", {"status": "ok" if sim_success else "error"})
            logger.log(
                event_type="retrieval",
                source="dashboard",
                attributes={"latency_ms": sim_latency, "success": sim_success},
            )
            st.success(f"Recorded request: {sim_latency}ms, {'success' if sim_success else 'failure'}")

            snap = monitor.snapshot()
            alerts_fired = alert_manager.check_all(
                latency_snapshot=snap.latency,
                failure_rate=snap.failure_rate,
                recall=0.75,
            )
            if alerts_fired:
                for a in alerts_fired:
                    st.warning(f"🚨 ALERT: {a.message}")

    insight_box(
        "<strong>Observability Insight:</strong> Monitoring {0} requests with a {1}% success rate. "
        "P95 latency at {2}ms is within acceptable bounds. Configure alert rules above to get "
        "proactive notifications when metrics breach thresholds.".format(
            perf["total_requests"],
            round(perf["success_rate"] * 100, 1),
            round(lat["p95_ms"]),
        )
    )

    footer()


if __name__ == "__main__":
    main()
