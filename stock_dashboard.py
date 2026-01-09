
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf

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
st.set_page_config(layout='wide', page_title='Real-Time Stock Dashboard')
st.title('Real-Time Stock Dashboard')

# Initialize session state for ticker if not present
if 'selected_ticker' not in st.session_state:
    st.session_state.selected_ticker = config.DEFAULT_TICKER
if 'goto_analysis' not in st.session_state:
    st.session_state.goto_analysis = False

# If a button requested navigation, set the radio key BEFORE the widget is created
if st.session_state.get('goto_analysis'):
    st.session_state['nav_radio'] = "Stock Analysis"
    st.session_state['goto_analysis'] = False

# Helper to switch to analysis
def switch_to_analysis(ticker):
    st.session_state.selected_ticker = ticker
    st.session_state.goto_analysis = True
    st.rerun()

# Sidebar Navigation
st.sidebar.header('Navigation')
page = st.sidebar.radio("Go to", ["Market Overview", "Stock Analysis"], key="nav_radio")

# Sidebar - Real-Time Stock Prices (Optimized)
st.sidebar.header('Real-Time Stock Prices')
with st.spinner('Loading sidebar prices...'):
    try:
        sidebar_data = fetch_batch_prices(config.DEFAULT_TICKERS)
        for symbol in config.DEFAULT_TICKERS:
            if symbol in sidebar_data:
                info = sidebar_data[symbol]
                st.sidebar.metric(
                    symbol, 
                    f"{info['price']:.2f} USD", 
                    f"{info['delta']:.2f} ({info['pct_delta']:.2f}%)"
                )
            else:
                 st.sidebar.text(f"{symbol}: N/A")
    except Exception as e:
        st.sidebar.error(f"Error loading prices: {e}")

st.sidebar.subheader('About')
st.sidebar.info('This dashboard provides real-time stock data and technical indicators for various time periods.')

# --- MAIN CONTENT ---

if page == "Market Overview":
    st.header("Global Market Overview")
    
    # 1. Market Indices
    st.subheader("Major Indices")
    indices_tickers = [item["ticker"] for item in config.MARKET_INDICES]
    
    with st.spinner("Fetching market indices..."):
        indices_data = fetch_batch_prices(indices_tickers)
        
    cols = st.columns(len(config.MARKET_INDICES))
    for i, idx_info in enumerate(config.MARKET_INDICES):
        ticker = idx_info["ticker"]
        name = idx_info["name"]
        
        if ticker in indices_data:
            data = indices_data[ticker]
            cols[i].metric(
                name,
                f"{data['price']:.2f}",
                f"{data['delta']:.2f} ({data['pct_delta']:.2f}%)"
            )
        else:
            cols[i].metric(name, "N/A", "0.00")

    # 2. Watchlist
    st.subheader("Your Watchlist")
    
    with st.spinner("Fetching watchlist..."):
        watchlist_data = fetch_batch_prices(config.WATCHLIST_TICKERS)
    
    # Display in a grid (3 columns)
    wl_cols = st.columns(3)
    for i, ticker in enumerate(config.WATCHLIST_TICKERS):
        col_idx = i % 3
        
        if ticker in watchlist_data:
            data = watchlist_data[ticker]
            with wl_cols[col_idx]:
                st.markdown(f"**{ticker}**")
                st.metric(
                    label="Price",
                    value=f"{data['price']:.2f} USD",
                    delta=f"{data['delta']:.2f} ({data['pct_delta']:.2f}%)"
                )
                st.button(f"Analyze {ticker}", key=f"btn_{ticker}", on_click=switch_to_analysis, args=(ticker,))
                st.divider()

elif page == "Stock Analysis":
    # Sidebar for user input parameters (Only for Stock Analysis)
    st.sidebar.header('Chart Parameters')

    # Smart ticker search with manual entry toggle
    manual_mode = st.sidebar.checkbox("Manual Ticker Entry", value=False)

    if manual_mode:
        # Manual text input
        # Use session state to populate if available
        ticker = st.sidebar.text_input('Ticker', st.session_state.selected_ticker)
    else:
        # Searchable dropdown
        if config.TOP_COMPANIES:
            company_options = [f"{item['symbol']} - {item['name']}" for item in config.TOP_COMPANIES]
            
            # Find default index based on session state
            default_index = 0
            current_ticker = st.session_state.selected_ticker
            for i, option in enumerate(company_options):
                if option.startswith(current_ticker):
                    default_index = i
                    break
            
            selected_option = st.sidebar.selectbox(
                'Select Company',
                company_options,
                index=default_index
            )
            ticker = selected_option.split(" - ")[0]
        else:
            ticker = st.sidebar.text_input('Ticker', st.session_state.selected_ticker)

    # Update session state with current selection
    st.session_state.selected_ticker = ticker

    time_period = st.sidebar.selectbox('Time Period', ['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y', 'max'])
    chart_type = st.sidebar.selectbox('Chart Type', ['Candlestick', 'Line'])
    indicators = st.sidebar.multiselect(
        'Technical Indicators', 
        [f'SMA {config.SMA_WINDOW}', f'EMA {config.EMA_WINDOW}', f'RSI {config.RSI_WINDOW}']
    )
    
    # Update button (or minimal auto-update)
    if st.sidebar.button('Update'):
        pass # Streamlit re-runs script on interaction anyway, this just forces it

    # Analysis Content
    with st.spinner(f'Accessing market data for {ticker}...'):
        try:
            data = fetch_stock_data(ticker, time_period, config.INTERVAL_MAPPING[time_period])
        except Exception as e:
            st.error(str(e))
            data = None

        if data is not None:
            data = process_data(data)
            # Use fill_na=False for charting
            data = add_technical_indicators(data, fill_na=False)

            metrics = calculate_metrics(data)
            
            last_close = metrics['last_close']
            change = metrics['change']
            pct_change = metrics['pct_change']
            high = metrics['high']
            low = metrics['low']
            volume = metrics['volume']
            volatility = metrics['volatility']
            sharpe_ratio = metrics['sharpe_ratio']
            risk_free_rate = metrics['risk_free_rate']

            # Display metrics
            st.metric(label=f"{ticker} Last Price", value=f"{last_close:.2f} USD", delta=f"{change:.2f} ({pct_change:.2f}%)")
            col1, col2, col3 = st.columns(3)
            col1.metric('High', f"{high:.2f} USD")
            col2.metric('Low', f"{low:.2f} USD")
            col3.metric('Volume', f"{volume:,}")

            # Display risk metrics
            st.subheader('Risk Profile')
            col4, col5, col6 = st.columns(3)
            col4.metric('Volatility (Ann.)', f"{volatility*100:.2f}%" if not np.isnan(volatility) else "N/A")
            col5.metric('Sharpe Ratio', f"{sharpe_ratio:.2f}" if not np.isnan(sharpe_ratio) else "N/A")
            col6.metric('Risk-Free Rate (10Y)', f"{risk_free_rate*100:.2f}%")

            # Create tabs for chart and historical data
            tab1, tab2 = st.tabs(["📈 Analysis", "📄 Historical Data"])
            
            with tab1:
                # Sentiment Analysis Section
                st.subheader('📊 Market Sentiment')
                with st.spinner('Analyzing news sentiment...'):
                    sentiment_data = fetch_news_sentiment(ticker)
                
                # Sentiment metrics row
                sent_col1, sent_col2, sent_col3 = st.columns(3)
                
                score = sentiment_data.get('sentiment_score', 0)
                label = sentiment_data.get('sentiment_label', 'Neutral')
                news_count = sentiment_data.get('news_count', 0)
                
                # Determine color and emoji based on sentiment
                if label == "Bullish":
                    sentiment_color = "green"
                    sentiment_emoji = "🟢"
                elif label == "Bearish":
                    sentiment_color = "red"
                    sentiment_emoji = "🔴"
                else:
                    sentiment_color = "gray"
                    sentiment_emoji = "⚪"
                
                sent_col1.metric(
                    "Sentiment Score", 
                    f"{score:.2f}",
                    delta=f"{sentiment_emoji} {label}"
                )
                sent_col2.metric("News Analyzed", news_count)
                sent_col3.metric("Market Mood", f"{sentiment_emoji} {label}")
                
                # News headlines expander
                headlines = sentiment_data.get('headlines', [])
                if headlines:
                    with st.expander("📰 Latest News & Sentiment Analysis", expanded=False):
                        for article in headlines:
                            article_score = article.get('score', 0)
                            if article_score > 0.1:
                                score_emoji = "🟢"
                            elif article_score < -0.1:
                                score_emoji = "🔴"
                            else:
                                score_emoji = "⚪"
                            
                            title = article.get('title', 'No title')
                            link = article.get('link', '')
                            publisher = article.get('publisher', '')
                            
                            if link:
                                st.markdown(f"{score_emoji} **[{title}]({link})**")
                            else:
                                st.markdown(f"{score_emoji} **{title}**")
                            
                            st.caption(f"Publisher: {publisher} | Sentiment: {article_score:.2f}")
                            st.divider()
                else:
                    message = sentiment_data.get('message', 'No news available for this ticker.')
                    st.info(message)
                
                st.divider()
                
                # Plot the Stock Price Chart
                fig = go.Figure()
                if chart_type == 'Candlestick':
                    fig.add_trace(go.Candlestick(x=data['Datetime'],
                                                 open=data['Open'],
                                                 high=data['High'],
                                                 low=data['Low'],
                                                 close=data['Close']))
                else:
                    fig = px.line(data, x='Datetime', y='Close')

                # Add selected technical indicators to chart
                for indicator in indicators:
                    if indicator == f'SMA {config.SMA_WINDOW}':
                        fig.add_trace(go.Scatter(x=data['Datetime'], y=data['SMA_20'], name=f'SMA {config.SMA_WINDOW}'))
                    elif indicator == f'EMA {config.EMA_WINDOW}':
                        fig.add_trace(go.Scatter(x=data['Datetime'], y=data['EMA_20'], name=f'EMA {config.EMA_WINDOW}'))
                    elif indicator == f'RSI {config.RSI_WINDOW}':
                        fig.add_trace(go.Scatter(x=data['Datetime'], y=data['RSI_14'], name=f'RSI {config.RSI_WINDOW}', yaxis="y2"))

                # Formatting of the chart
                fig.update_layout(title=f"{ticker} {time_period.upper()} Chart",
                          xaxis_title='Time',
                          yaxis_title='Price (USD)',
                          yaxis2={'title': 'RSI', 'overlaying': 'y', 'side': 'right', 'showgrid': False},
                          height=600)
                st.plotly_chart(fig, use_container_width=True)

            with tab2:
                # Display historical data & technical indicators
                st.subheader('Historical Data')
                st.dataframe(data[['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']])

                st.subheader('Technical Indicators')
                st.dataframe(data[['Datetime', 'SMA_20', 'EMA_20', 'RSI_14']])
