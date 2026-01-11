import streamlit as st
from backend import config

def initialize_session_state():
    """Initialize all session state variables with default values."""
    if 'selected_ticker' not in st.session_state:
        st.session_state.selected_ticker = config.DEFAULT_TICKER
    if 'search_history' not in st.session_state:
        st.session_state.search_history = []
    if 'time_period' not in st.session_state:
        st.session_state.time_period = '1y'
    if 'chart_type' not in st.session_state:
        st.session_state.chart_type = 'Candlestick'
    if 'indicators' not in st.session_state:
        st.session_state.indicators = []
    if 'inflation_adjusted' not in st.session_state:
        st.session_state.inflation_adjusted = False

def add_to_history(ticker):
    """Add ticker to search history, keeping last 5 unique entries."""
    if ticker in st.session_state.search_history:
        st.session_state.search_history.remove(ticker)
    st.session_state.search_history.insert(0, ticker)
    st.session_state.search_history = st.session_state.search_history[:5]
