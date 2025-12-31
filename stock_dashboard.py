
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf

# Import shared service functions from backend
from backend.services import (
    fetch_stock_data as _fetch_stock_data,
    process_data,
    add_technical_indicators as _add_technical_indicators,
    calculate_metrics as _calculate_metrics,
)


# Wrapper for fetch_stock_data to handle Streamlit error display
def fetch_stock_data(ticker, period, interval):
    """Fetch stock data with Streamlit error handling."""
    try:
        data = _fetch_stock_data(ticker, period, interval)
        return data
    except Exception as e:
        st.error(str(e))
        return None


# Wrapper for add_technical_indicators - use fill_na=False for charting
def add_technical_indicators(data):
    """Add technical indicators without filling NaN (preserves chart quality)."""
    return _add_technical_indicators(data, fill_na=False)


# Wrapper for calculate_metrics - returns tuple for backward compatibility
def calculate_metrics(data):
    """Calculate metrics and return as tuple for dashboard unpacking."""
    metrics = _calculate_metrics(data)
    return (
        metrics['last_close'],
        metrics['change'],
        metrics['pct_change'],
        metrics['high'],
        metrics['low'],
        metrics['volume'],
    )

# Fetch 10-Year Treasury Yield as risk-free rate
def fetch_risk_free_rate():
    """Fetches the current 10-Year Treasury Yield from yfinance."""
    try:
        treasury = yf.Ticker("^TNX")
        hist = treasury.history(period="5d")
        if not hist.empty:
            # Get the most recent close price and convert to decimal (e.g., 4.5% -> 0.045)
            rate = float(hist['Close'].iloc[-1]) / 100.0
            return rate
        return 0.04  # Default to 4% if unable to fetch
    except Exception as e:
        st.warning(f"Unable to fetch risk-free rate: {e}. Using default 4%.")
        return 0.04

# Calculate risk metrics (Annualized Volatility & Sharpe Ratio)
def calculate_risk_metrics(data, risk_free_rate=0.04):
    """
    Calculates Annualized Volatility and Sharpe Ratio.
    data: Pandas DataFrame with a 'Close' column.
    risk_free_rate: Float (e.g., 0.04 for 4%).
    """
    if data is None or len(data) < 2:
        return np.nan, np.nan

    # Coerce Close to numeric series and calculate Daily Returns
    close_col = data['Close']
    # If Close is a DataFrame (unexpected multi-column), try to squeeze to Series
    if isinstance(close_col, pd.DataFrame):
        try:
            close_series = close_col.squeeze()
        except Exception:
            close_series = close_col.iloc[:, 0]
    else:
        close_series = close_col

    close_series = pd.to_numeric(close_series, errors='coerce')
    returns = close_series.pct_change().dropna()

    if len(returns) < 2:
        return np.nan, np.nan

    # Annualized Volatility (Standard Deviation * sqrt(252 trading days))
    volatility = float(returns.std() * np.sqrt(252))

    # Annualized Return (Mean daily return * 252)
    annualized_return = float(returns.mean() * 252)

    # Sharpe Ratio (guard against zero/NaN volatility)
    if volatility == 0 or np.isnan(volatility):
        sharpe = np.nan
    else:
        sharpe = float((annualized_return - risk_free_rate) / volatility)

    return volatility, sharpe

# Dashboard app page layout
st.set_page_config(layout='wide')
st.title('Real-Time Stock Dashboard')

# Sidebar for user input parameters
st.sidebar.header('Chart Parameters')
ticker = st.sidebar.text_input('Ticker', 'AAPL')
time_period = st.sidebar.selectbox('Time Period', ['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y', 'max'])
chart_type = st.sidebar.selectbox('Chart Type', ['Candlestick', 'Line'])
indicators = st.sidebar.multiselect('Technical Indicators', ['SMA 20', 'EMA 20', 'RSI 14'])

# Interval Mapping
interval_mapping = {
    '1d': '1m',
    '5d': '5m',
    '1mo': '1h',
    '3mo': '1d',
    '6mo': '1d',
    '1y': '1wk',
    '5y': '1mo',
    'max': '1mo',
}

# Update dashboard based on user inputs
if st.sidebar.button('Update'):
    data = fetch_stock_data(ticker, time_period, interval_mapping[time_period])
    if data is not None:
        data = process_data(data)
        data = add_technical_indicators(data)

        last_close, change, pct_change, high, low, volume = calculate_metrics(data)

        # Fetch risk-free rate and calculate risk metrics
        risk_free_rate = fetch_risk_free_rate()
        volatility, sharpe_ratio = calculate_risk_metrics(data, risk_free_rate)

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
            if indicator == 'SMA 20':
                fig.add_trace(go.Scatter(x=data['Datetime'], y=data['SMA_20'], name='SMA 20'))
            elif indicator == 'EMA 20':
                fig.add_trace(go.Scatter(x=data['Datetime'], y=data['EMA_20'], name='EMA 20'))
            elif indicator == 'RSI 14':
                fig.add_trace(go.Scatter(x=data['Datetime'], y=data['RSI_14'], name='RSI 14', yaxis="y2"))

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
stock_symbols = ['AAPL', 'GOOGL', 'AMZN', 'MSFT']
for symbol in stock_symbols:
    real_time_data = fetch_stock_data(symbol, '1d', '1m')
    if real_time_data is not None:
        real_time_data = process_data(real_time_data)
        last_price = float(real_time_data['Close'].iloc[-1].item())
        change = last_price - float(real_time_data['Open'].iloc[0].item())
        pct_change = (change / float(real_time_data['Open'].iloc[0].item())) * 100
        st.sidebar.metric(f"{symbol}", f"{last_price:.2f} USD", f"{change:.2f} ({pct_change:.2f}%)")

# Sidebar information section
st.sidebar.subheader('About')
st.sidebar.info('This dashboard provides real-time stock data and technical indicators for various time periods.')
