from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from dashboard.theme import Color, Radius, Shadow, Spacing, LEAF_LOGO_SVG


def render_logo(size: int = 28) -> str:
    return f"""<svg width="{size}" height="{size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 5 C45 15 30 25 20 30 C10 35 5 42 5 50 C5 58 10 65 18 68 C22 70 28 70 32 68 L35 72 C30 78 28 85 30 90 C32 95 38 97 44 95 C50 93 55 88 58 82 C62 88 68 93 74 95 C80 97 86 95 88 90 C90 85 88 78 83 72 L86 68 C90 70 96 70 100 68 C95 60 92 50 92 40 C92 30 88 22 80 18 C72 14 62 10 55 5 C53 3 52 2 50 5Z" fill="#FF5A0A"/>
  <path d="M35 35 L50 25 L65 35 L60 50 L50 45 L40 50 L35 35Z" fill="#FF7A1A" opacity="0.6"/>
  <line x1="50" y1="25" x2="50" y2="70" stroke="#FF7A1A" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
  <line x1="30" y1="45" x2="50" y2="50" stroke="#FF7A1A" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
  <line x1="70" y1="45" x2="50" y2="50" stroke="#FF7A1A" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
</svg>"""


def sidebar() -> None:
    st.sidebar.markdown(
        f"""
        <div class="kairos-sidebar-header">
            {render_logo(32)}
            <div>
                <div class="logo-text">Kairos</div>
                <div class="logo-subtitle">Adaptive Retrieval Intelligence</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    nav = [
        ("Overview", "🏠", "app"),
        ("Benchmarks", "📊", "benchmarks"),
        ("Experiments", "🧪", "experiments"),
        ("Ablations", "🔬", "ablations"),
        ("Statistics", "📈", "statistics"),
        ("Observability", "👁", "observability"),
        ("Leaderboard", "🏆", "leaderboard"),
        ("Domain Analysis", "🌎", "domain_analysis"),
        ("Planner Analysis", "🧠", "planner_analysis"),
        ("Cost Analysis", "💰", "cost_analysis"),
        ("Ablation V2", "🔬", "ablation_v2"),
        ("Judge Dashboard", "⚖", "judge_dashboard"),
        ("Comparisons", "📊", "comparisons"),
    ]

    st.sidebar.markdown(
        f'<div class="kairos-nav-section">Analytics</div>',
        unsafe_allow_html=True,
    )

    for label, icon, page in nav:
        display = f"{icon}  {label}"
        if st.sidebar.button(display, key=f"nav_{page}", use_container_width=True):
            if page == "app":
                st.switch_page("app.py")
            else:
                st.switch_page(f"pages/{page}.py")

    st.sidebar.markdown("---")
    st.sidebar.markdown(
        f"""
        <div class="kairos-sidebar-footer">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem;">
                <span class="status-dot green"></span>
                <span style="color:{Color.TEXT_SECONDARY};">System Online</span>
            </div>
            <div style="font-size:0.625rem;">Kairos v1.0 · {len(nav)} modules</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def page_header(title: str, subtitle: str = "") -> None:
    st.markdown(
        f"""
        <div class="kairos-hero">
            <h1>{title}</h1>
            {f'<p class="subtitle">{subtitle}</p>' if subtitle else ""}
        </div>
        <div class="kairos-hero-divider"></div>
        """,
        unsafe_allow_html=True,
    )


def metric_card(label: str, value: str, delta: str | None = None, delta_dir: str = "normal") -> None:
    st.metric(label=label, value=value, delta=delta, delta_color=delta_dir)


def kpi_row(metrics: list[dict]) -> None:
    cols = st.columns(len(metrics))
    for col, m in zip(cols, metrics):
        with col:
            metric_card(
                label=m.get("label", ""),
                value=m.get("value", ""),
                delta=m.get("delta"),
                delta_dir=m.get("delta_dir", "normal"),
            )


def render_icon_card(icon: str, title: str, value: str, subtitle: str = "") -> None:
    st.markdown(
        f"""
        <div class="kairos-card" style="text-align:center;padding:1.5rem 1rem;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">{icon}</div>
            <div style="font-size:0.75rem;color:{Color.TEXT_SECONDARY};font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">{title}</div>
            <div style="font-size:1.75rem;font-weight:700;color:{Color.TEXT_PRIMARY};letter-spacing:-0.02em;">{value}</div>
            {f'<div style="font-size:0.75rem;color:{Color.TEXT_MUTED};margin-top:0.125rem;">{subtitle}</div>' if subtitle else ""}
        </div>
        """,
        unsafe_allow_html=True,
    )


def status_badge(text: str, variant: str = "neutral") -> None:
    st.markdown(
        f'<span class="kairos-badge {variant}">{text}</span>',
        unsafe_allow_html=True,
    )


def insight_box(text: str) -> None:
    st.markdown(f'<div class="kairos-insight">{text}</div>', unsafe_allow_html=True)


def empty_state(title: str = "No Data Available", message: str = "") -> None:
    st.markdown(
        f"""
        <div class="kairos-empty">
            {render_logo(48)}
            <h3>{title}</h3>
            <p>{message}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def footer() -> None:
    st.markdown(
        f"""
        <div class="kairos-footer">
            <div class="footer-brand">
                {render_logo(18)}
                <span>Kairos v1.0</span>
            </div>
            <div class="footer-right">
                <span>Adaptive Retrieval Intelligence Platform</span>
                <span class="status-dot green"></span>
                <span style="color:{Color.SUCCESS};">All Systems Normal</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def chart_container(fig: go.Figure, key: str | None = None) -> None:
    st.markdown('<div class="kairos-chart-box">', unsafe_allow_html=True)
    st.plotly_chart(fig, use_container_width=True, key=key)
    st.markdown("</div>", unsafe_allow_html=True)


def dark_fig(fig: go.Figure, height: int = 300) -> go.Figure:
    fig.update_layout(
        height=height,
        margin=dict(l=40, r=20, t=40, b=40),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=Color.TEXT_SECONDARY, size=11, family="Inter, sans-serif"),
        xaxis=dict(gridcolor=Color.BORDER, showgrid=False, zeroline=False),
        yaxis=dict(gridcolor=Color.BORDER, showgrid=True, zeroline=False),
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor=Color.SURFACE,
            font_color=Color.TEXT_PRIMARY,
            bordercolor=Color.BORDER,
            font_size=12,
        ),
    )
    return fig


def bar_chart(
    df,
    x: str,
    y: str,
    title: str = "",
    color: str = Color.ORANGE_PRIMARY,
    height: int = 300,
) -> go.Figure:
    fig = go.Figure(data=[go.Bar(x=df[x], y=df[y], marker_color=color)])
    fig.update_layout(title=dict(text=title, font=dict(size=13, color=Color.TEXT_PRIMARY)))
    return dark_fig(fig, height)


def grouped_bar(
    df,
    x: str,
    y_labels: list[str],
    title: str = "",
    height: int = 300,
) -> go.Figure:
    colors = [Color.ORANGE_PRIMARY, "#4361ee", Color.SUCCESS, Color.WARNING, "#9C27B0", "#00BCD4"]
    fig = go.Figure()
    melted = df.melt(id_vars=[x], value_vars=y_labels, var_name="Series", value_name="Value")
    for i, col in enumerate(y_labels):
        subset = melted[melted["Series"] == col]
        fig.add_trace(go.Bar(
            name=col,
            x=subset[x],
            y=subset["Value"],
            marker_color=colors[i % len(colors)],
        ))
    fig.update_layout(
        title=dict(text=title, font=dict(size=13, color=Color.TEXT_PRIMARY)),
        barmode="group",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1, font=dict(size=10)),
    )
    return dark_fig(fig, height)


def styled_dataframe(df: pd.DataFrame, key: str | None = None) -> None:
    st.dataframe(df, use_container_width=True, key=key)
