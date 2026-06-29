from __future__ import annotations

import streamlit as st


class Color:
    ORANGE_PRIMARY = "#FF5A0A"
    ORANGE_SECONDARY = "#FF7A1A"
    ORANGE_GLOW = "rgba(255, 90, 10, 0.15)"
    DARK_BG = "#0B0F14"
    SURFACE = "#131A22"
    SURFACE_HOVER = "#1B2430"
    BORDER = "#2A3441"
    TEXT_PRIMARY = "#F5F7FA"
    TEXT_SECONDARY = "#AAB4C3"
    TEXT_MUTED = "#6B7A8F"
    SUCCESS = "#22C55E"
    WARNING = "#F59E0B"
    ERROR = "#EF4444"
    WHITE = "#FFFFFF"
    TRANSPARENT = "transparent"


class Spacing:
    XS = "0.25rem"
    SM = "0.5rem"
    MD = "1rem"
    LG = "1.5rem"
    XL = "2rem"
    XXL = "3rem"
    SECTION = "2.5rem"


class Radius:
    CARD = "16px"
    CARD_LG = "20px"
    BUTTON = "10px"
    BADGE = "8px"
    INPUT = "10px"
    PILL = "9999px"


class Shadow:
    CARD = "0 4px 24px rgba(0,0,0,0.3)"
    CARD_HOVER = "0 8px 40px rgba(0,0,0,0.4), 0 0 60px rgba(255,90,10,0.05)"
    GLOW = "0 0 30px rgba(255,90,10,0.15)"
    GLOW_STRONG = "0 0 60px rgba(255,90,10,0.25)"


LEAF_LOGO_SVG = """<svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 5 C45 15 30 25 20 30 C10 35 5 42 5 50 C5 58 10 65 18 68 C22 70 28 70 32 68 L35 72 C30 78 28 85 30 90 C32 95 38 97 44 95 C50 93 55 88 58 82 C62 88 68 93 74 95 C80 97 86 95 88 90 C90 85 88 78 83 72 L86 68 C90 70 96 70 100 68 C95 60 92 50 92 40 C92 30 88 22 80 18 C72 14 62 10 55 5 C53 3 52 2 50 5Z" fill="#FF5A0A"/>
  <path d="M35 35 L50 25 L65 35 L60 50 L50 45 L40 50 L35 35Z" fill="#FF7A1A" opacity="0.6"/>
  <line x1="50" y1="25" x2="50" y2="70" stroke="#FF7A1A" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
  <line x1="30" y1="45" x2="50" y2="50" stroke="#FF7A1A" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
  <line x1="70" y1="45" x2="50" y2="50" stroke="#FF7A1A" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
</svg>"""


def get_base_css() -> str:
    return f"""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        html, body, [class*="css"] {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        }}

        .stApp {{
            background: {Color.DARK_BG};
        }}

        .block-container {{
            padding-top: 1.25rem !important;
            padding-bottom: 0.5rem !important;
            max-width: 1400px;
        }}

        /* === SIDEBAR === */
        section[data-testid="stSidebar"] {{
            background: {Color.SURFACE} !important;
            border-right: 1px solid {Color.BORDER} !important;
            min-width: 240px !important;
        }}

        section[data-testid="stSidebar"] .stButton button {{
            background: {Color.TRANSPARENT} !important;
            border: none !important;
            border-radius: {Radius.BUTTON} !important;
            color: {Color.TEXT_SECONDARY} !important;
            font-weight: 500 !important;
            font-size: 0.8125rem !important;
            padding: 0.5rem 0.75rem !important;
            margin: 0.125rem 0 !important;
            transition: all 0.15s ease !important;
            text-align: left !important;
            width: 100% !important;
            display: flex !important;
            align-items: center !important;
            gap: 0.5rem !important;
        }}

        section[data-testid="stSidebar"] .stButton button:hover {{
            background: {Color.SURFACE_HOVER} !important;
            color: {Color.TEXT_PRIMARY} !important;
        }}

        section[data-testid="stSidebar"] .stButton button:active,
        section[data-testid="stSidebar"] .stButton button:focus {{
            background: {Color.ORANGE_GLOW} !important;
            color: {Color.ORANGE_PRIMARY} !important;
        }}

        /* === LOGO HEADER === */
        .kairos-sidebar-header {{
            padding: 1.25rem 1rem 0.75rem 1rem;
            display: flex;
            align-items: center;
            gap: 0.625rem;
            border-bottom: 1px solid {Color.BORDER};
            margin-bottom: 0.75rem;
        }}

        .kairos-sidebar-header .logo-text {{
            font-size: 1.125rem;
            font-weight: 700;
            color: {Color.TEXT_PRIMARY};
            letter-spacing: -0.02em;
        }}

        .kairos-sidebar-header .logo-subtitle {{
            font-size: 0.625rem;
            color: {Color.TEXT_MUTED};
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin-top: -0.125rem;
        }}

        .kairos-nav-section {{
            color: {Color.TEXT_MUTED} !important;
            font-size: 0.625rem !important;
            text-transform: uppercase !important;
            letter-spacing: 0.08em !important;
            font-weight: 600 !important;
            padding: 0.75rem 1rem 0.25rem 1rem !important;
        }}

        .kairos-sidebar-footer {{
            padding: 0.75rem 1rem;
            border-top: 1px solid {Color.BORDER};
            margin-top: auto;
            font-size: 0.6875rem;
            color: {Color.TEXT_MUTED};
        }}

        /* === CARDS === */
        .kairos-card {{
            background: {Color.SURFACE};
            border: 1px solid {Color.BORDER};
            border-radius: {Radius.CARD};
            padding: 1.25rem;
            transition: all 0.2s ease;
            box-shadow: {Shadow.CARD};
        }}

        .kairos-card:hover {{
            border-color: rgba(255,90,10,0.2);
            box-shadow: {Shadow.CARD_HOVER};
        }}

        .kairos-card-glass {{
            background: linear-gradient(135deg, rgba(19,26,34,0.9) 0%, rgba(19,26,34,0.6) 100%);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(42,52,65,0.5);
            border-radius: {Radius.CARD};
            padding: 1.25rem;
            transition: all 0.2s ease;
        }}

        .kairos-card-glass:hover {{
            border-color: rgba(255,90,10,0.3);
        }}

        /* === METRIC CARDS === */
        .kairos-metric {{
            background: {Color.SURFACE};
            border: 1px solid {Color.BORDER};
            border-radius: {Radius.CARD};
            padding: 1.25rem;
            text-align: center;
        }}

        .kairos-metric .metric-icon {{
            font-size: 1.25rem;
            margin-bottom: 0.375rem;
        }}

        .kairos-metric .metric-label {{
            color: {Color.TEXT_SECONDARY};
            font-size: 0.6875rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        .kairos-metric .metric-value {{
            color: {Color.TEXT_PRIMARY};
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin: 0.125rem 0;
        }}

        .kairos-metric .metric-delta {{
            font-size: 0.75rem;
            font-weight: 500;
        }}

        .kairos-metric .metric-delta.positive {{ color: {Color.SUCCESS}; }}
        .kairos-metric .metric-delta.negative {{ color: {Color.ERROR}; }}
        .kairos-metric .metric-delta.neutral {{ color: {Color.TEXT_MUTED}; }}

        /* === BADGES === */
        .kairos-badge {{
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.1875rem 0.5rem;
            border-radius: {Radius.BADGE};
            font-size: 0.6875rem;
            font-weight: 600;
            letter-spacing: 0.02em;
        }}

        .kairos-badge.active {{ background: rgba(34,197,94,0.12); color: {Color.SUCCESS}; border: 1px solid rgba(34,197,94,0.25); }}
        .kairos-badge.warning {{ background: rgba(245,158,11,0.12); color: {Color.WARNING}; border: 1px solid rgba(245,158,11,0.25); }}
        .kairos-badge.error {{ background: rgba(239,68,68,0.12); color: {Color.ERROR}; border: 1px solid rgba(239,68,68,0.25); }}
        .kairos-badge.info {{ background: rgba(255,90,10,0.12); color: {Color.ORANGE_PRIMARY}; border: 1px solid rgba(255,90,10,0.25); }}
        .kairos-badge.neutral {{ background: rgba(42,52,65,0.5); color: {Color.TEXT_SECONDARY}; border: 1px solid {Color.BORDER}; }}

        /* === PAGE HERO === */
        .kairos-hero {{
            margin-bottom: 1.5rem;
        }}

        .kairos-hero h1 {{
            font-size: 1.75rem;
            font-weight: 700;
            color: {Color.TEXT_PRIMARY};
            letter-spacing: -0.03em;
            margin: 0 0 0.25rem 0;
            display: flex;
            align-items: center;
            gap: 0.625rem;
        }}

        .kairos-hero .subtitle {{
            color: {Color.TEXT_SECONDARY};
            font-size: 0.875rem;
            margin: 0;
        }}

        .kairos-hero-divider {{
            height: 2px;
            background: linear-gradient(90deg, {Color.ORANGE_PRIMARY} 0%, rgba(255,90,10,0.2) 50%, transparent 100%);
            margin: 0.75rem 0 1.5rem 0;
            border: none;
            border-radius: 2px;
        }}

        /* === HERO SECTION (HOME) === */
        .kairos-home-hero {{
            text-align: center;
            padding: 2.5rem 1rem 1.5rem 1rem;
        }}

        .kairos-home-hero .logo-large {{
            margin-bottom: 1rem;
        }}

        .kairos-home-hero h1 {{
            font-size: 2.75rem;
            font-weight: 800;
            color: {Color.TEXT_PRIMARY};
            letter-spacing: -0.03em;
            margin-bottom: 0.5rem;
        }}

        .kairos-home-hero h1 .accent {{ color: {Color.ORANGE_PRIMARY}; }}

        .kairos-home-hero p {{
            color: {Color.TEXT_SECONDARY};
            font-size: 1.125rem;
            max-width: 520px;
            margin: 0 auto;
            line-height: 1.6;
        }}

        .kairos-home-hero .system-badge {{
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(34,197,94,0.1);
            border: 1px solid rgba(34,197,94,0.2);
            padding: 0.375rem 0.875rem;
            border-radius: {Radius.PILL};
            font-size: 0.75rem;
            font-weight: 600;
            color: {Color.SUCCESS};
            margin-bottom: 1.25rem;
        }}

        .kairos-home-hero .system-badge .dot {{
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: {Color.SUCCESS};
            display: inline-block;
        }}

        /* === FOOTER === */
        .kairos-footer {{
            margin-top: 3rem;
            padding: 1.25rem 0 0.5rem 0;
            border-top: 1px solid {Color.BORDER};
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: {Color.TEXT_MUTED};
            font-size: 0.75rem;
        }}

        .kairos-footer .footer-brand {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}

        .kairos-footer .footer-brand svg {{
            width: 18px;
            height: 18px;
        }}

        .kairos-footer .footer-right {{
            display: flex;
            align-items: center;
            gap: 1rem;
        }}

        /* === DIVIDERS & TITLES === */
        .kairos-section-title {{
            font-size: 1rem;
            font-weight: 600;
            color: {Color.TEXT_PRIMARY};
            margin: 1.5rem 0 0.75rem 0;
            letter-spacing: -0.01em;
        }}

        /* === CHARTS === */
        .kairos-chart-box {{
            background: {Color.SURFACE};
            border: 1px solid {Color.BORDER};
            border-radius: {Radius.CARD};
            padding: 0.75rem;
            margin-bottom: 1rem;
            transition: all 0.2s ease;
        }}

        .kairos-chart-box:hover {{
            border-color: rgba(255,90,10,0.15);
        }}

        /* === DATAFRAMES === */
        div[data-testid="stDataFrame"] {{
            border: 1px solid {Color.BORDER} !important;
            border-radius: {Radius.CARD} !important;
            overflow: hidden !important;
        }}

        div[data-testid="stDataFrame"] thead tr th {{
            background: {Color.SURFACE} !important;
            color: {Color.TEXT_SECONDARY} !important;
            font-size: 0.6875rem !important;
            font-weight: 600 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
            padding: 0.625rem 1rem !important;
            border-bottom: 1px solid {Color.BORDER} !important;
        }}

        div[data-testid="stDataFrame"] tbody tr td {{
            background: {Color.DARK_BG} !important;
            color: {Color.TEXT_PRIMARY} !important;
            font-size: 0.8125rem !important;
            padding: 0.5rem 1rem !important;
            border-bottom: 1px solid rgba(42,52,65,0.3) !important;
        }}

        div[data-testid="stDataFrame"] tbody tr:hover td {{
            background: {Color.SURFACE_HOVER} !important;
        }}

        /* === METRIC WIDGET OVERRIDE === */
        div[data-testid="metric-container"] {{
            background: {Color.SURFACE} !important;
            border: 1px solid {Color.BORDER} !important;
            border-radius: {Radius.CARD} !important;
            padding: 1rem 1.25rem !important;
            box-shadow: {Shadow.CARD};
        }}

        div[data-testid="metric-container"] label {{
            color: {Color.TEXT_SECONDARY} !important;
            font-size: 0.6875rem !important;
            font-weight: 500 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
        }}

        div[data-testid="metric-container"] [data-testid="stMetricValue"] {{
            color: {Color.TEXT_PRIMARY} !important;
            font-size: 1.75rem !important;
            font-weight: 700 !important;
            letter-spacing: -0.02em !important;
        }}

        div[data-testid="metric-container"] [data-testid="stMetricDelta"] {{
            font-size: 0.75rem !important;
            font-weight: 500 !important;
        }}

        /* === BUTTONS === */
        .stButton button {{
            border-radius: {Radius.BUTTON} !important;
            font-weight: 500 !important;
            font-size: 0.8125rem !important;
            transition: all 0.15s ease !important;
        }}

        .stButton button[data-baseweb="button"]:hover {{
            transform: translateY(-1px);
            box-shadow: 0 4px 20px rgba(255,90,10,0.2);
        }}

        /* === SELECT BOX === */
        div[data-baseweb="select"] > div {{
            background: {Color.SURFACE} !important;
            border-color: {Color.BORDER} !important;
            border-radius: {Radius.INPUT} !important;
        }}

        /* === MULTISELECT === */
        div[data-baseweb="tag"] {{
            background: rgba(255,90,10,0.12) !important;
            color: {Color.ORANGE_PRIMARY} !important;
            border-radius: 6px !important;
        }}

        /* === TEXT INPUT === */
        .stTextArea textarea {{
            background: {Color.SURFACE} !important;
            border-color: {Color.BORDER} !important;
            border-radius: {Radius.INPUT} !important;
            color: {Color.TEXT_PRIMARY} !important;
        }}

        /* === CHECKBOX === */
        .stCheckbox label {{
            color: {Color.TEXT_SECONDARY} !important;
        }}

        /* === TABS === */
        button[data-baseweb="tab"] {{
            font-size: 0.8125rem !important;
            font-weight: 500 !important;
        }}

        button[data-baseweb="tab"][aria-selected="true"] {{
            color: {Color.ORANGE_PRIMARY} !important;
        }}

        /* === SLIDER === */
        div[data-baseweb="slider"] div[role="slider"] {{
            background: {Color.ORANGE_PRIMARY} !important;
        }}

        div[data-baseweb="slider"] div[role="slider"]:focus {{
            box-shadow: 0 0 0 3px rgba(255,90,10,0.3) !important;
        }}

        /* === STATUS MESSAGES === */
        .stAlert {{
            border-radius: {Radius.CARD} !important;
            border: 1px solid {Color.BORDER} !important;
        }}

        .stInfo {{
            background: rgba(255,90,10,0.06) !important;
            border-left: 3px solid {Color.ORANGE_PRIMARY} !important;
        }}

        .stSuccess {{
            background: rgba(34,197,94,0.06) !important;
            border-left: 3px solid {Color.SUCCESS} !important;
        }}

        .stWarning {{
            background: rgba(245,158,11,0.06) !important;
            border-left: 3px solid {Color.WARNING} !important;
        }}

        .stError {{
            background: rgba(239,68,68,0.06) !important;
            border-left: 3px solid {Color.ERROR} !important;
        }}

        /* === EMPTY STATE === */
        .kairos-empty {{
            text-align: center;
            padding: 3rem 1rem;
            color: {Color.TEXT_MUTED};
        }}

        .kairos-empty svg {{
            opacity: 0.4;
            margin-bottom: 1rem;
        }}

        .kairos-empty h3 {{
            color: {Color.TEXT_SECONDARY};
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }}

        .kairos-empty p {{
            font-size: 0.8125rem;
            max-width: 400px;
            margin: 0 auto;
        }}

        /* === SCROLLBAR === */
        ::-webkit-scrollbar {{
            width: 6px;
            height: 6px;
        }}

        ::-webkit-scrollbar-track {{
            background: {Color.DARK_BG};
        }}

        ::-webkit-scrollbar-thumb {{
            background: {Color.BORDER};
            border-radius: 3px;
        }}

        ::-webkit-scrollbar-thumb:hover {{
            background: {Color.TEXT_MUTED};
        }}

        /* === RECENT ACTIVITY TABLE === */
        .kairos-activity-row {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.625rem 0;
            border-bottom: 1px solid rgba(42,52,65,0.3);
        }}

        .kairos-activity-row:last-child {{
            border-bottom: none;
        }}

        .kairos-activity-row .activity-left {{
            display: flex;
            align-items: center;
            gap: 0.625rem;
        }}

        .kairos-activity-row .activity-time {{
            color: {Color.TEXT_MUTED};
            font-size: 0.6875rem;
            font-family: 'JetBrains Mono', monospace;
        }}

        .kairos-activity-row .activity-event {{
            color: {Color.TEXT_PRIMARY};
            font-size: 0.8125rem;
        }}

        /* === STATUS DOT === */
        .status-dot {{
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }}

        .status-dot.green {{ background: {Color.SUCCESS}; box-shadow: 0 0 8px rgba(34,197,94,0.4); }}
        .status-dot.yellow {{ background: {Color.WARNING}; box-shadow: 0 0 8px rgba(245,158,11,0.4); }}
        .status-dot.red {{ background: {Color.ERROR}; box-shadow: 0 0 8px rgba(239,68,68,0.4); }}
        .status-dot.orange {{ background: {Color.ORANGE_PRIMARY}; box-shadow: 0 0 8px rgba(255,90,10,0.4); }}

        /* === GLASS PANEL === */
        .glass-panel {{
            background: linear-gradient(135deg, rgba(19,26,34,0.7) 0%, rgba(19,26,34,0.3) 100%);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(42,52,65,0.4);
            border-radius: {Radius.CARD_LG};
            padding: 1.5rem;
        }}

        /* === RESPONSIVE GRID === */
        .kairos-grid-2 {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }}

        .kairos-grid-3 {{
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 1rem;
        }}

        .kairos-grid-4 {{
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 1rem;
        }}

        @media (max-width: 768px) {{
            .kairos-grid-2, .kairos-grid-3, .kairos-grid-4 {{
                grid-template-columns: 1fr;
            }}
        }}

        /* === INFO HOVER === */
        .kairos-insight {{
            background: rgba(255,90,10,0.05);
            border-left: 3px solid {Color.ORANGE_PRIMARY};
            border-radius: 0 8px 8px 0;
            padding: 0.75rem 1rem;
            margin: 1rem 0;
            font-size: 0.8125rem;
            color: {Color.TEXT_SECONDARY};
        }}

        .kairos-insight strong {{
            color: {Color.TEXT_PRIMARY};
        }}

        /* === RANK BADGES === */
        .rank-1 {{ color: #FFD700; font-weight: 700; }}
        .rank-2 {{ color: #C0C0C0; font-weight: 700; }}
        .rank-3 {{ color: #CD7F32; font-weight: 700; }}
    </style>
    """


def inject_css() -> None:
    st.markdown(get_base_css(), unsafe_allow_html=True)
