
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
)

# Dashboard app page layout
st.set_page_config(layout='wide')
st.title('Real-Time Stock Dashboard')

# Sidebar for user input parameters
st.sidebar.header('Chart Parameters')
ticker = st.sidebar.text_input('Ticker', config.DEFAULT_TICKER)
time_period = st.sidebar.selectbox('Time Period', ['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y', 'max'])
chart_type = st.sidebar.selectbox('Chart Type', ['Candlestick', 'Line'])
indicators = st.sidebar.multiselect(
    'Technical Indicators', 
    [f'SMA {config.SMA_WINDOW}', f'EMA {config.EMA_WINDOW}', f'RSI {config.RSI_WINDOW}']
)

# Update dashboard based on user inputs
if st.sidebar.button('Update'):
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
        st.plotly_chart(fig, width='stretch')

        # Display historical data & technical indicators
        st.subheader('Historical Data')
        st.dataframe(data[['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']])

        st.subheader('Technical Indicators')
        st.dataframe(data[['Datetime', 'SMA_20', 'EMA_20', 'RSI_14']])

# Real-time stock prices of selected symbols in sidebar
st.sidebar.header('Real-Time Stock Prices')
for symbol in config.DEFAULT_TICKERS:
    try:
        real_time_data = fetch_stock_data(symbol, '1d', '1m')
    except Exception:
        real_time_data = None
        
    if real_time_data is not None:
        real_time_data = process_data(real_time_data)
        last_price = float(real_time_data['Close'].iloc[-1].item())
        change = last_price - float(real_time_data['Open'].iloc[0].item())
        pct_change = (change / float(real_time_data['Open'].iloc[0].item())) * 100
        st.sidebar.metric(f"{symbol}", f"{last_price:.2f} USD", f"{change:.2f} ({pct_change:.2f}%)")

# Sidebar information section
st.sidebar.subheader('About')
st.sidebar.info('This dashboard provides real-time stock data and technical indicators for various time periods.')
