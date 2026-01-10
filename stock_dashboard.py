import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf
from datetime import datetime
import pytz

# Import shared service functions from backend
from backend import config
from backend.services import (
    fetch_stock_data,
    process_data,
    add_technical_indicators,
    calculate_metrics,
    fetch_news_sentiment,
    fetch_batch_prices,
)

# Dashboard app page layout
st.set_page_config(
    layout='wide', 
    page_title='Cycle Navigator Dashboard',
    initial_sidebar_state="collapsed"
)

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

# --- HELPER FUNCTIONS ---
def add_to_history(ticker):
    """Add ticker to search history, keeping last 5 unique entries."""
    if ticker in st.session_state.search_history:
        st.session_state.search_history.remove(ticker)
    st.session_state.search_history.insert(0, ticker)
    st.session_state.search_history = st.session_state.search_history[:5]

def is_market_open():
    """Check if US markets are currently open (9:30 AM - 4:00 PM ET, Mon-Fri)."""
    et = pytz.timezone('US/Eastern')
    now = datetime.now(et)
    
    # Check if weekend
    if now.weekday() >= 5:
        return False
    
    # Check market hours (9:30 AM - 4:00 PM ET)
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    
    return market_open <= now <= market_close

def switch_to_ticker(ticker):
    """Callback to switch ticker and add to history."""
    st.session_state.selected_ticker = ticker
    add_to_history(ticker)

def main():
    inject_custom_css()

    # --- INITIALIZE SESSION STATE ---
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

    # --- 3. MAIN NAVIGATION TABS ---
    tab_home, tab_analysis = st.tabs(["🏠 Market Overview", "🔍 Detailed Analysis"])

    # ============================================================
    # TAB 1: MARKET OVERVIEW (HOME)
    # ============================================================
    with tab_home:
        # --- Market Indices Ticker Tape ---
        st.subheader("📊 Major Indices")
        indices_tickers = [item["ticker"] for item in config.MARKET_INDICES]
        
        with st.spinner("Fetching market indices..."):
            try:
                indices_data = fetch_batch_prices(indices_tickers)
            except Exception:
                indices_data = {}
        
        idx_cols = st.columns(len(config.MARKET_INDICES))
        for i, idx_info in enumerate(config.MARKET_INDICES):
            ticker = idx_info["ticker"]
            name = idx_info["name"]
            
            if ticker in indices_data:
                data = indices_data[ticker]
                delta_color = "normal" if data['delta'] >= 0 else "inverse"
                idx_cols[i].metric(
                    name,
                    f"{data['price']:,.2f}",
                    f"{data['delta']:.2f} ({data['pct_delta']:.2f}%)"
                )
            else:
                idx_cols[i].metric(name, "N/A", "0.00")
        
        st.markdown("---")
        
        # --- Watchlist Grid ---
        st.subheader("👀 Your Watchlist")
        
        with st.spinner("Fetching watchlist..."):
            try:
                watchlist_data = fetch_batch_prices(config.WATCHLIST_TICKERS)
            except Exception:
                watchlist_data = {}
        
        # Display in a 3-column grid
        wl_cols = st.columns(3)
        for i, ticker in enumerate(config.WATCHLIST_TICKERS):
            col_idx = i % 3
            
            if ticker in watchlist_data:
                data = watchlist_data[ticker]
                with wl_cols[col_idx]:
                    # Card-style container
                    with st.container():
                        st.markdown(f"### {ticker}")
                        st.metric(
                            label="Price",
                            value=f"${data['price']:.2f}",
                            delta=f"{data['delta']:.2f} ({data['pct_delta']:.2f}%)"
                        )
                        if st.button(f"📈 Analyze", key=f"btn_{ticker}", use_container_width=True):
                            st.session_state.selected_ticker = ticker
                            add_to_history(ticker)
                            st.rerun()
                        st.markdown("---")

    # ============================================================
    # TAB 2: DETAILED ANALYSIS
    # ============================================================
    with tab_analysis:
        ticker = st.session_state.selected_ticker
        
        # --- SIDEBAR: Chart Settings (Only visible in Analysis tab) ---
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
                manual_ticker = st.text_input("Manual Ticker Entry", value=ticker)
                if manual_ticker and manual_ticker.upper() != ticker:
                    if st.button("Apply"):
                        st.session_state.selected_ticker = manual_ticker.upper()
                        add_to_history(manual_ticker.upper())
                        st.rerun()
            
            st.markdown("---")
            st.caption("Cycle Navigator v1.0")
        
        # --- Main Analysis Content ---
        st.header(f"📈 {ticker} Analysis")
        
        with st.spinner(f'Loading market data for {ticker}...'):
            try:
                stock_data = fetch_stock_data(ticker, time_period, config.INTERVAL_MAPPING[time_period])
            except Exception as e:
                st.error(f"Error fetching data: {str(e)}")
                stock_data = None
            
            if stock_data is not None:
                stock_data = process_data(stock_data)
                stock_data = add_technical_indicators(stock_data, fill_na=False)
                metrics = calculate_metrics(stock_data)
                
                last_close = metrics['last_close']
                change = metrics['change']
                pct_change = metrics['pct_change']
                high = metrics['high']
                low = metrics['low']
                volume = metrics['volume']
                volatility = metrics['volatility']
                sharpe_ratio = metrics['sharpe_ratio']
                risk_free_rate = metrics['risk_free_rate']
                
                # --- Price & Metrics Row ---
                price_col, metric_cols = st.columns([2, 3])
                
                with price_col:
                    delta_color = "normal" if change >= 0 else "inverse"
                    st.metric(
                        label=f"{ticker} Last Price",
                        value=f"${last_close:.2f}",
                        delta=f"{change:.2f} ({pct_change:.2f}%)"
                    )
                
                with metric_cols:
                    m1, m2, m3 = st.columns(3)
                    m1.metric('High', f"${high:.2f}")
                    m2.metric('Low', f"${low:.2f}")
                    m3.metric('Volume', f"{volume:,}")
                
                # --- Risk Profile ---
                st.subheader('📊 Risk Profile')
                risk_cols = st.columns(3)
                risk_cols[0].metric('Volatility (Ann.)', f"{volatility*100:.2f}%" if not np.isnan(volatility) else "N/A")
                risk_cols[1].metric('Sharpe Ratio', f"{sharpe_ratio:.2f}" if not np.isnan(sharpe_ratio) else "N/A")
                risk_cols[2].metric('Risk-Free Rate', f"{risk_free_rate*100:.2f}%")
                
                st.markdown("---")
                
                # --- Sub-tabs for Chart vs Data ---
                chart_tab, sentiment_tab, data_tab = st.tabs(["📈 Price Chart", "📰 Sentiment", "📄 Historical Data"])
                
                with chart_tab:
                    # Build the chart
                    fig = go.Figure()
                    
                    if chart_type == 'Candlestick':
                        fig.add_trace(go.Candlestick(
                            x=stock_data['Datetime'],
                            open=stock_data['Open'],
                            high=stock_data['High'],
                            low=stock_data['Low'],
                            close=stock_data['Close'],
                            name='Price'
                        ))
                    else:
                        fig.add_trace(go.Scatter(
                            x=stock_data['Datetime'],
                            y=stock_data['Close'],
                            mode='lines',
                            name='Close Price'
                        ))
                    
                    # Add technical indicators
                    for indicator in indicators:
                        if indicator == f'SMA {config.SMA_WINDOW}':
                            fig.add_trace(go.Scatter(
                                x=stock_data['Datetime'],
                                y=stock_data['SMA_20'],
                                name=f'SMA {config.SMA_WINDOW}',
                                line=dict(dash='dot')
                            ))
                        elif indicator == f'EMA {config.EMA_WINDOW}':
                            fig.add_trace(go.Scatter(
                                x=stock_data['Datetime'],
                                y=stock_data['EMA_20'],
                                name=f'EMA {config.EMA_WINDOW}',
                                line=dict(dash='dash')
                            ))
                        elif indicator == f'RSI {config.RSI_WINDOW}':
                            fig.add_trace(go.Scatter(
                                x=stock_data['Datetime'],
                                y=stock_data['RSI_14'],
                                name=f'RSI {config.RSI_WINDOW}',
                                yaxis="y2"
                            ))
                    
                    fig.update_layout(
                        title=f"{ticker} - {time_period.upper()} Chart",
                        xaxis_title='Time',
                        yaxis_title='Price (USD)',
                        yaxis2={'title': 'RSI', 'overlaying': 'y', 'side': 'right', 'showgrid': False},
                        height=600
                        # template='plotly_dark'  <-- Removed to allow native Streamlit theming
                    )
                    
                    st.plotly_chart(fig, use_container_width=True)
                
                with sentiment_tab:
                    st.subheader('📊 Market Sentiment')
                    
                    with st.spinner('Analyzing news sentiment...'):
                        sentiment_data = fetch_news_sentiment(ticker)
                    
                    score = sentiment_data.get('sentiment_score', 0)
                    label = sentiment_data.get('sentiment_label', 'Neutral')
                    news_count = sentiment_data.get('news_count', 0)
                    
                    # Sentiment emoji
                    if label == "Bullish":
                        sentiment_emoji = "🟢"
                    elif label == "Bearish":
                        sentiment_emoji = "🔴"
                    else:
                        sentiment_emoji = "⚪"
                    
                    sent_cols = st.columns(3)
                    sent_cols[0].metric("Sentiment Score", f"{score:.2f}", delta=f"{sentiment_emoji} {label}")
                    sent_cols[1].metric("News Analyzed", news_count)
                    sent_cols[2].metric("Market Mood", f"{sentiment_emoji} {label}")
                    
                    # News headlines
                    headlines = sentiment_data.get('headlines', [])
                    if headlines:
                        st.markdown("---")
                        st.subheader("📰 Latest News")
                        for article in headlines:
                            article_score = article.get('score', 0)
                            if article_score > 0.1:
                                emoji = "🟢"
                            elif article_score < -0.1:
                                emoji = "🔴"
                            else:
                                emoji = "⚪"
                            
                            title = article.get('title', 'No title')
                            link = article.get('link', '')
                            publisher = article.get('publisher', '')
                            
                            if link:
                                st.markdown(f"{emoji} **[{title}]({link})**")
                            else:
                                st.markdown(f"{emoji} **{title}**")
                            
                            st.caption(f"Publisher: {publisher} | Sentiment: {article_score:.2f}")
                            st.divider()
                    else:
                        message = sentiment_data.get('message', 'No news available for this ticker.')
                        st.info(message)
                
                with data_tab:
                    st.subheader('📄 Historical Price Data')
                    st.dataframe(
                        stock_data[['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']],
                        use_container_width=True
                    )
                    
                    st.subheader('📐 Technical Indicators')
                    st.dataframe(
                        stock_data[['Datetime', 'SMA_20', 'EMA_20', 'RSI_14']],
                        use_container_width=True
                    )

if __name__ == "__main__":
    main()
