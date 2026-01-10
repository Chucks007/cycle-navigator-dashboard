import streamlit as st

def setup_app_config():
    """Configure page settings and inject custom CSS."""
    st.set_page_config(
        layout='wide', 
        page_title='Cycle Navigator Dashboard',
        initial_sidebar_state="collapsed"
    )
    inject_custom_css()

def inject_custom_css():
    """Inject custom CSS for advanced UI styling."""
    st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Inter', sans-serif;
}

/* Metric Card "Pills" */
[data-testid="stMetricDelta"] > div {
    background-color: rgba(0, 128, 0, 0.1); /* Light green for positive */
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
}

/* For negative deltas, using the svg color selector strategy */
[data-testid="stMetricDelta"] svg[color="red"] + div {
    background-color: rgba(255, 0, 0, 0.1) !important;
}

/* Tab & Container Styling */
.stTabs [data-baseweb="tab-list"] {
    gap: 24px;
}

.stTabs [data-baseweb="tab"] {
    height: 50px;
    white-space: pre-wrap;
    background-color: transparent;
    border-radius: 4px 4px 0px 0px;
    gap: 1px;
}

/* Add shadow to the main chart container */
[data-testid="stVerticalBlock"] > div:has(div.stPlotlyChart) {
    background-color: var(--secondary-background-color);
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
</style>
""", unsafe_allow_html=True)
