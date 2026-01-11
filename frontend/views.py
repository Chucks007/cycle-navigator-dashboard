import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
from backend import config
from backend.services import (
    fetch_stock_data,
    process_data,
    add_technical_indicators,
    calculate_metrics,
    fetch_news_sentiment,
    fetch_batch_prices,
    fetch_risk_free_rate,
)
from backend.macro_service import macro_service
from frontend.state import add_to_history
from frontend.utils import get_sentiment_emoji
from frontend.layout import render_sidebar

def render_overview_tab():
    """Render the Market Overview tab content."""
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
            # delta_color = "normal" if data['delta'] >= 0 else "inverse" # Unused variable
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


def render_macro_tab():
    """Render the Macro Watchtower tab."""
    st.subheader("🏰 Macro Watchtower")
    
    col1, col2, col3 = st.columns(3)
    
    with st.spinner("Fetching macro data..."):
        liquidity = macro_service.get_liquidity()
        debt = macro_service.get_debt_status()
        real_rates = macro_service.get_real_rates()
        
    # Liquidity Fuel
    if liquidity:
        curr_m2 = liquidity[0]['value'] / 1000 # Trillions
        m2_growth = liquidity[0]['growth_rate'] * 100
        col1.metric("Liquidity Fuel (M2)", f"${curr_m2:.2f}T", f"{m2_growth:.2f}% YoY")
    else:
        col1.metric("Liquidity Fuel (M2)", "N/A", "N/A")
        
    # Debt Pressure
    if debt:
        curr_ratio = debt[0]['ratio']
        prev_ratio = debt[1]['ratio'] if len(debt) > 1 else 0
        delta = curr_ratio - prev_ratio
        col2.metric("Debt Pressure (Int/Tax)", f"{curr_ratio:.1f}%", f"{delta:.1f}%")
    else:
        col2.metric("Debt Pressure", "N/A", "N/A")
        
    # Real Yield
    if real_rates:
        curr_real = real_rates[0]['real_rate'] * 100
        prev_real = real_rates[1]['real_rate'] * 100 if len(real_rates) > 1 else 0
        delta_real = curr_real - prev_real
        col3.metric("Real Yield (10Y - CPI)", f"{curr_real:.2f}%", f"{delta_real:.2f}%")
    else:
        col3.metric("Real Yield", "N/A", "N/A")

    st.markdown("### The 'Melt-Up' Correlation")
    
    # Dual Axis Chart
    sp500 = fetch_stock_data('^GSPC', '5y', '1d') # 5 years
    
    if sp500 is not None and not sp500.empty and liquidity:
        sp500 = process_data(sp500)
        
        # Prepare M2 Dataframe
        m2_df = pd.DataFrame(liquidity)
        m2_df['date'] = pd.to_datetime(m2_df['date'])
        # Localize M2 date to match stock data (US/Eastern) for plot alignment if needed, 
        # but plotly usually handles mixed naive/aware ok on axis. 
        # But let's be safe and make stock naive for plotting or both aware.
        # Stock data is aware US/Eastern.
        
        m2_df = m2_df.sort_values('date')
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        
        # Trace 1: S&P 500
        fig.add_trace(
            go.Scatter(x=sp500['Datetime'], y=sp500['Close'], name="S&P 500", 
                       line=dict(color='#00F0FF', width=2)),
            secondary_y=False
        )
        
        # Trace 2: M2
        fig.add_trace(
            go.Scatter(x=m2_df['date'], y=m2_df['value'], name="M2 Money Supply",
                       line=dict(color='#FF00FF', width=2, dash='dot'),
                       fill='tozeroy', fillcolor='rgba(255, 0, 255, 0.1)'),
            secondary_y=True
        )
        
        fig.update_layout(
            title_text="Global Liquidity vs. Asset Prices",
            template="plotly_dark",
            height=500,
            hovermode="x unified",
            legend=dict(orientation="h", y=1.1) 
        )
        
        fig.update_yaxes(title_text="S&P 500 Price", secondary_y=False)
        fig.update_yaxes(title_text="M2 Supply (Billions)", secondary_y=True)
        
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.error("Could not load chart data.")

def render_analysis_tab():
    """Render the Detailed Analysis tab content."""
    ticker = st.session_state.selected_ticker
    
    # Render Sidebar Settings
    render_sidebar()

    st.sidebar.markdown("---")
    st.sidebar.header("Purchasing Power")
    use_real_value = st.sidebar.checkbox(
        "View in Purchasing Power (CPI Adjusted)", 
        value=st.session_state.get('inflation_adjusted', False),
        key='inflation_adjusted'
    )
    
    # --- Main Analysis Content ---
    st.header(f"📈 {ticker} Analysis")
    
    with st.spinner(f'Loading market data for {ticker}...'):
        try:
            stock_data = fetch_stock_data(ticker, st.session_state.time_period, config.INTERVAL_MAPPING[st.session_state.time_period])
        except Exception as e:
            st.error(f"Error fetching data: {str(e)}")
            stock_data = None
        
        if stock_data is not None:
            stock_data = process_data(stock_data)

            # --- Inflation Adjustment Logic ---
            if use_real_value:
                try:
                    cpi_data = macro_service.get_cpi_series()
                    if cpi_data:
                        cpi_df = pd.DataFrame(cpi_data)
                        cpi_df['date'] = pd.to_datetime(cpi_df['date'])
                        # Localize to US/Eastern to match stock_data 
                        if cpi_df['date'].dt.tz is None:
                             cpi_df['date'] = cpi_df['date'].dt.tz_localize('US/Eastern')
                        
                        cpi_df = cpi_df.set_index('date').sort_index()
                        
                        # Sort data for merge_asof
                        stock_data = stock_data.sort_values('Datetime')
                        
                        combined = pd.merge_asof(
                            stock_data[['Datetime']], 
                            cpi_df, 
                            left_on='Datetime', 
                            right_index=True, 
                            direction='backward'
                        )
                        
                        # Assign CPI to original dataframe matching index/order
                        # Note: merge_asof preserved order of left frame (stock_data)
                        stock_data['cpi_at_t'] = combined['value']
                        
                        current_cpi = cpi_df['value'].iloc[-1]
                        
                        # Avoid division by zero/nan
                        stock_data['adj_factor'] = current_cpi / stock_data['cpi_at_t']
                        
                        # Adjust Prices
                        cols_to_adjust = ['Open', 'High', 'Low', 'Close']
                        for col in cols_to_adjust:
                            if col in stock_data.columns:
                                stock_data[col] = stock_data[col] * stock_data['adj_factor']
                        
                        # Remove helper columns
                        stock_data.drop(columns=['cpi_at_t', 'adj_factor'], inplace=True)
                        
                        st.info(f"💡 Prices adjusted to Real Value (CPI Adjusted). Base CPI: {current_cpi:.2f}")
                except Exception as e:
                    st.warning(f"Could not apply purchasing power adjustment: {e}")

            stock_data = add_technical_indicators(stock_data, fill_na=False)
            rfr = fetch_risk_free_rate()
            metrics = calculate_metrics(stock_data, rfr)
            
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
                # delta_color = "normal" if change >= 0 else "inverse" # Streamlit handles this automatically mostly
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
                _render_price_chart(ticker, stock_data)
            
            with sentiment_tab:
                _render_sentiment_tab(ticker)
            
            with data_tab:
                _render_data_tab(stock_data)

def _render_price_chart(ticker, stock_data):
    """Helper to render the price chart using Plotly."""
    chart_type = st.session_state.chart_type
    indicators = st.session_state.indicators
    time_period = st.session_state.time_period

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
        # template='plotly_dark'
    )
    
    st.plotly_chart(fig, use_container_width=True)

def _render_sentiment_tab(ticker):
    """Helper to render the sentiment analysis tab."""
    st.subheader('📊 Market Sentiment')
    
    with st.spinner('Analyzing news sentiment...'):
        sentiment_data = fetch_news_sentiment(ticker)
    
    score = sentiment_data.get('sentiment_score', 0)
    label = sentiment_data.get('sentiment_label', 'Neutral')
    news_count = sentiment_data.get('news_count', 0)
    
    # Sentiment emoji
    sentiment_emoji = get_sentiment_emoji(score)
    # The original code checked label for emoji, my utils checks score. 
    # Let's check consistency. Original:
    # if label == "Bullish": emoji = "🟢" ...
    # Utils: if score > 0.1 ...
    # Assuming label "Bullish" corresponds to score > 0.1, it's roughly consistent.
    # I'll stick to my utils for consistency or just use the label logic if preferred. 
    # Let's use the label-based emoji for the main metric to match original logic precisely if I can.
    # But I used `get_sentiment_emoji` for articles.
    
    # Let's re-implement label emoji logic locally for the top metric to match exact behavior
    if label == "Bullish":
        main_emoji = "🟢"
    elif label == "Bearish":
        main_emoji = "🔴"
    else:
        main_emoji = "⚪"
    
    sent_cols = st.columns(3)
    sent_cols[0].metric("Sentiment Score", f"{score:.2f}", delta=f"{main_emoji} {label}")
    sent_cols[1].metric("News Analyzed", news_count)
    sent_cols[2].metric("Market Mood", f"{main_emoji} {label}")
    
    # News headlines
    headlines = sentiment_data.get('headlines', [])
    if headlines:
        st.markdown("---")
        st.subheader("📰 Latest News")
        for article in headlines:
            article_score = article.get('score', 0)
            emoji = get_sentiment_emoji(article_score)
            
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

def _render_data_tab(stock_data):
    """Helper to render the historical data tab."""
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
