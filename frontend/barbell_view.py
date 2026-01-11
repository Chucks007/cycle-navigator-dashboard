"""
Barbell Strategy View Component.

This module provides the UI for the "Asset Class War" comparison chart,
allowing users to compare hard assets vs paper assets performance.
"""

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
from typing import List

from backend.comparison_service import (
    fetch_normalized_comparison,
    calculate_hard_vs_soft_ratio,
    get_performance_summary,
    get_asset_info,
    HARD_ASSETS,
    SOFT_ASSETS,
    COMPARISON_PERIODS
)


# Color schemes for assets
ASSET_COLORS = {
    # Hard Assets - warm colors
    "GLD": "#FFD700",      # Gold
    "SLV": "#C0C0C0",      # Silver
    "BTC-USD": "#F7931A",  # Bitcoin orange
    # Soft Assets - cool colors
    "SPY": "#00D4FF",      # Cyan for S&P
    "TLT": "#9D4EDD",      # Purple for bonds
}


def render_barbell_strategy():
    """Render the Barbell Strategy comparison section."""
    
    st.subheader("⚖️ The Barbell Strategy")
    st.markdown("""
    Compare the performance of **Hard Assets** (Gold, Silver, Bitcoin) against 
    **Paper Assets** (Stocks, Bonds) to track the rotation into inflation hedges.
    """)
    
    # --- Asset Selection ---
    col1, col2, col3 = st.columns([2, 2, 1])
    
    asset_info = get_asset_info()
    
    with col1:
        st.markdown("**🪨 Hard Assets**")
        hard_options = [f"{ticker} - {name}" for ticker, name in HARD_ASSETS.items()]
        selected_hard = st.multiselect(
            "Select Hard Assets",
            options=hard_options,
            default=hard_options,
            key="barbell_hard_assets",
            label_visibility="collapsed"
        )
        selected_hard_tickers = [s.split(" - ")[0] for s in selected_hard]
    
    with col2:
        st.markdown("**📄 Paper Assets**")
        soft_options = [f"{ticker} - {name}" for ticker, name in SOFT_ASSETS.items()]
        selected_soft = st.multiselect(
            "Select Paper Assets",
            options=soft_options,
            default=soft_options,
            key="barbell_soft_assets",
            label_visibility="collapsed"
        )
        selected_soft_tickers = [s.split(" - ")[0] for s in selected_soft]
    
    with col3:
        st.markdown("**📅 Period**")
        period_options = list(COMPARISON_PERIODS.keys())
        selected_period_label = st.selectbox(
            "Timeframe",
            options=period_options,
            index=1,  # Default to 1Y
            key="barbell_period",
            label_visibility="collapsed"
        )
        selected_period = COMPARISON_PERIODS[selected_period_label]
    
    # Combine selected assets
    all_selected = selected_hard_tickers + selected_soft_tickers
    
    if not all_selected:
        st.warning("Please select at least one asset to display.")
        return
    
    # --- Fetch and Display Data ---
    with st.spinner("Fetching asset data..."):
        try:
            raw_df, normalized_df = fetch_normalized_comparison(all_selected, selected_period)
        except Exception as e:
            st.error(f"Error fetching data: {e}")
            return
    
    if normalized_df.empty:
        st.error("No data available for the selected assets and period.")
        return
    
    # --- Performance Summary Cards ---
    st.markdown("### 📊 Performance Summary")
    summary = get_performance_summary(normalized_df)
    
    # Create columns for metric cards
    cols = st.columns(len(summary))
    for i, (ticker, data) in enumerate(summary.items()):
        with cols[i]:
            emoji = "🪨" if data['asset_type'] == "Hard Asset" else "📄"
            delta_color = "normal" if data['pct_gain'] >= 0 else "inverse"
            st.metric(
                label=f"{emoji} {data['name']}",
                value=f"{data['current_value']:.1f}",
                delta=f"{data['pct_gain']:+.1f}%",
                delta_color=delta_color
            )
    
    st.markdown("---")
    
    # --- Normalized Performance Chart ---
    st.markdown("### 📈 Normalized Performance Chart")
    st.caption("All assets indexed to 100 at the start of the period for direct comparison.")
    
    fig_performance = _create_performance_chart(normalized_df, selected_hard_tickers, selected_soft_tickers)
    st.plotly_chart(fig_performance, use_container_width=True)
    
    # --- Hard vs Soft Ratio ---
    if selected_hard_tickers and selected_soft_tickers:
        st.markdown("---")
        st.markdown("### ⚔️ Hard vs Soft Ratio")
        st.markdown("""
        **Interpretation:**
        - 📈 **Rising Line** = Hard assets outperforming (inflation hedge thesis validated)
        - 📉 **Falling Line** = Paper assets outperforming
        """)
        
        try:
            ratio_df = calculate_hard_vs_soft_ratio(
                normalized_df, 
                hard_assets=selected_hard_tickers,
                soft_assets=selected_soft_tickers
            )
            fig_ratio = _create_ratio_chart(ratio_df)
            st.plotly_chart(fig_ratio, use_container_width=True)
            
            # Current ratio status
            current_ratio = ratio_df['Ratio_Normalized'].dropna().iloc[-1]
            ratio_change = current_ratio - 100
            
            if ratio_change > 5:
                status_emoji = "🟢"
                status_text = "Hard assets significantly outperforming"
            elif ratio_change > 0:
                status_emoji = "🟡"
                status_text = "Hard assets slightly outperforming"
            elif ratio_change > -5:
                status_emoji = "🟡"
                status_text = "Paper assets slightly outperforming"
            else:
                status_emoji = "🔴"
                status_text = "Paper assets significantly outperforming"
            
            col1, col2 = st.columns(2)
            with col1:
                st.metric(
                    "Hard/Soft Ratio",
                    f"{current_ratio:.1f}",
                    f"{ratio_change:+.1f}% from start"
                )
            with col2:
                st.info(f"{status_emoji} **{status_text}**")
                
        except Exception as e:
            st.warning(f"Could not calculate ratio: {e}")


def _create_performance_chart(
    normalized_df: pd.DataFrame, 
    hard_tickers: List[str], 
    soft_tickers: List[str]
) -> go.Figure:
    """Create the normalized performance comparison chart."""
    
    fig = go.Figure()
    
    # Add traces for each asset
    for ticker in normalized_df.columns:
        color = ASSET_COLORS.get(ticker, "#888888")
        
        # Determine if hard or soft asset for grouping
        if ticker in HARD_ASSETS:
            name = f"🪨 {HARD_ASSETS[ticker]}"
            dash = "solid"
        elif ticker in SOFT_ASSETS:
            name = f"📄 {SOFT_ASSETS[ticker]}"
            dash = "dash"
        else:
            name = ticker
            dash = "dot"
        
        fig.add_trace(go.Scatter(
            x=normalized_df.index,
            y=normalized_df[ticker],
            name=name,
            line=dict(color=color, width=2, dash=dash),
            hovertemplate=(
                f"<b>{name}</b><br>" +
                "Date: %{x|%Y-%m-%d}<br>" +
                "Value: %{y:.2f}<br>" +
                "Gain: %{customdata:+.2f}%<extra></extra>"
            ),
            customdata=normalized_df[ticker] - 100
        ))
    
    # Add horizontal line at 100 (starting point)
    fig.add_hline(
        y=100, 
        line_dash="dot", 
        line_color="rgba(255,255,255,0.3)",
        annotation_text="Start (100)",
        annotation_position="bottom right"
    )
    
    fig.update_layout(
        title="Asset Class Performance Comparison (Indexed to 100)",
        xaxis_title="Date",
        yaxis_title="Indexed Value (Base = 100)",
        template="plotly_dark",
        height=500,
        hovermode="x unified",
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="center",
            x=0.5
        )
    )
    
    return fig


def _create_ratio_chart(ratio_df: pd.DataFrame) -> go.Figure:
    """Create the Hard vs Soft ratio chart."""
    
    fig = go.Figure()
    
    # Main ratio line
    fig.add_trace(go.Scatter(
        x=ratio_df.index,
        y=ratio_df['Ratio_Normalized'],
        name="Hard/Soft Ratio",
        line=dict(color="#00FF88", width=3),
        fill='tozeroy',
        fillcolor='rgba(0, 255, 136, 0.1)',
        hovertemplate=(
            "<b>Hard/Soft Ratio</b><br>" +
            "Date: %{x|%Y-%m-%d}<br>" +
            "Ratio: %{y:.2f}<br>" +
            "<extra></extra>"
        )
    ))
    
    # Add horizontal line at 100 (equilibrium)
    fig.add_hline(
        y=100, 
        line_dash="solid", 
        line_color="rgba(255,255,255,0.5)",
        annotation_text="Equilibrium",
        annotation_position="right"
    )
    
    # Add shaded regions
    y_max = ratio_df['Ratio_Normalized'].max() * 1.05
    y_min = ratio_df['Ratio_Normalized'].min() * 0.95
    
    # Hard assets winning zone (above 100)
    fig.add_hrect(
        y0=100, y1=y_max,
        fillcolor="rgba(0, 255, 0, 0.05)",
        layer="below",
        line_width=0,
    )
    
    # Soft assets winning zone (below 100)
    fig.add_hrect(
        y0=y_min, y1=100,
        fillcolor="rgba(255, 0, 0, 0.05)",
        layer="below",
        line_width=0,
    )
    
    fig.update_layout(
        title="Hard Assets vs Paper Assets Ratio (Rising = Hard Outperforming)",
        xaxis_title="Date",
        yaxis_title="Ratio (Indexed to 100)",
        template="plotly_dark",
        height=400,
        hovermode="x unified",
        showlegend=False
    )
    
    # Add annotations
    fig.add_annotation(
        x=0.02, y=0.95,
        xref="paper", yref="paper",
        text="🪨 Hard Assets Zone",
        showarrow=False,
        font=dict(color="rgba(0,255,0,0.7)", size=12),
        align="left"
    )
    
    fig.add_annotation(
        x=0.02, y=0.05,
        xref="paper", yref="paper",
        text="📄 Paper Assets Zone",
        showarrow=False,
        font=dict(color="rgba(255,0,0,0.7)", size=12),
        align="left"
    )
    
    return fig
