import streamlit as st
from datetime import datetime
import pytz
from backend import config
from frontend.state import add_to_history
from frontend.utils import is_market_open

def render_header():
    """Render the application header with branding, market status, and search."""
    # --- 1. GLOBAL HEADER ---
    # Centered branding
    st.markdown("""
<h1 style='text-align: center; margin-bottom: 0;'>⚡ CYCLE NAVIGATOR</h1>
<p style='text-align: center; color: #888; margin-top: 0;'>Real-Time Stock Analysis Dashboard</p>
""", unsafe_allow_html=True)

    # Header row: Market Status + Search + Current Time
    header_col1, header_col2, header_col3 = st.columns([1, 3, 1])

    with header_col1:
        # Market status indicator
        if is_market_open():
            st.markdown("🟢 **Markets Open**")
        else:
            st.markdown("🔴 **Markets Closed**")

    with header_col2:
        # Prepare searchable options
        company_options = [f"{item['symbol']} - {item['name']}" for item in config.TOP_COMPANIES] if config.TOP_COMPANIES else []
        
        # Find current selection index
        current_fmt_list = [o for o in company_options if o.startswith(st.session_state.selected_ticker + " ")]
        current_index = company_options.index(current_fmt_list[0]) if current_fmt_list else 0
        
        selected_search = st.selectbox(
            "🔍 Search stocks (e.g. Nvidia, Apple, Tesla...)",
            options=company_options,
            index=current_index,
            label_visibility="collapsed",
            placeholder="🔍 Search stocks (e.g. Nvidia, Apple, Tesla...)"
        )
        
        # Handle selection change
        new_ticker = selected_search.split(" - ")[0]
        if new_ticker != st.session_state.selected_ticker:
            st.session_state.selected_ticker = new_ticker
            add_to_history(new_ticker)
            st.rerun()

    with header_col3:
        # Current time in ET
        et = pytz.timezone('US/Eastern')
        now = datetime.now(et)
        st.markdown(f"🕐 **{now.strftime('%I:%M %p ET')}**")

    # --- 2. RECENT SEARCHES (Chips) ---
    if st.session_state.search_history:
        chip_cols = st.columns([1, 3, 1])
        with chip_cols[1]:
            st.caption("Recent searches:")
            chip_buttons = st.columns(len(st.session_state.search_history))
            for i, ticker in enumerate(st.session_state.search_history):
                with chip_buttons[i]:
                    if st.button(ticker, key=f"chip_{ticker}", use_container_width=True):
                        st.session_state.selected_ticker = ticker
                        st.rerun()

    st.markdown("---")

def render_sidebar():
    """Render the sidebar settings for the analysis tab."""
    with st.sidebar:
        st.header("📊 Chart Settings")
        
        st.subheader("Time Period")
        time_period = st.selectbox(
            'Select Period',
            ['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y', 'max'],
            index=['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y', 'max'].index(st.session_state.time_period),
            key='time_period_select'
        )
        st.session_state.time_period = time_period
        
        st.subheader("Chart Type")
        chart_type = st.selectbox(
            'Select Type',
            ['Candlestick', 'Line'],
            index=['Candlestick', 'Line'].index(st.session_state.chart_type),
            key='chart_type_select'
        )
        st.session_state.chart_type = chart_type
        
        st.subheader("Technical Indicators")
        indicators = st.multiselect(
            'Select Indicators',
            [f'SMA {config.SMA_WINDOW}', f'EMA {config.EMA_WINDOW}', f'RSI {config.RSI_WINDOW}'],
            default=st.session_state.indicators,
            key='indicators_select'
        )
        st.session_state.indicators = indicators
        
        st.markdown("---")
        
        # Manual ticker entry
        with st.expander("⚙️ Advanced Options"):
            manual_ticker = st.text_input("Manual Ticker Entry", value=st.session_state.selected_ticker)
            if manual_ticker and manual_ticker.upper() != st.session_state.selected_ticker:
                if st.button("Apply"):
                    st.session_state.selected_ticker = manual_ticker.upper()
                    add_to_history(manual_ticker.upper())
                    st.rerun()
        
        st.markdown("---")
        st.caption("Cycle Navigator v1.0")
