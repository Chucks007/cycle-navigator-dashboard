import streamlit as st
from frontend.styles import setup_app_config
from frontend.state import initialize_session_state
from frontend.layout import render_header
from frontend.views import render_overview_tab, render_analysis_tab

def main():
    setup_app_config()           # Styling & Page Config
    initialize_session_state()    # State management
    render_header()              # UI Component (includes search & branding)
    
    # --- 3. MAIN NAVIGATION TABS ---
    tab_overview, tab_analysis = st.tabs(["🏠 Market Overview", "🔍 Detailed Analysis"])
    
    with tab_overview:
        render_overview_tab()    # UI Component
    with tab_analysis:
        render_analysis_tab()    # UI Component

if __name__ == "__main__":
    main()
