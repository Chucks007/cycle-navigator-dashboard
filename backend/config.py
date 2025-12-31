"""
Configuration constants for the Stock Dashboard application.

This module centralizes all hardcoded values and magic numbers used throughout
the application, making them easier to maintain and adjust.
"""

# Financial Constants
DEFAULT_RISK_FREE_RATE = 0.04  # 4% fallback rate when unable to fetch current rate
TRADING_DAYS_PER_YEAR = 252  # Standard number of trading days per year

# Technical Indicator Settings
SMA_WINDOW = 20  # Simple Moving Average window
EMA_WINDOW = 20  # Exponential Moving Average window
RSI_WINDOW = 14  # Relative Strength Index window

# Dashboard Defaults
DEFAULT_TICKERS = ['AAPL', 'GOOGL', 'AMZN', 'MSFT']  # Real-time stock symbols in sidebar
DEFAULT_TICKER = 'AAPL'  # Default ticker symbol for the main chart

# Mapping logic for time periods to intervals
# Maps user-selected time periods to appropriate data intervals
INTERVAL_MAPPING = {
    '1d': '1m',    # 1 day: 1-minute intervals
    '5d': '5m',    # 5 days: 5-minute intervals
    '1mo': '1h',   # 1 month: hourly intervals
    '3mo': '1d',   # 3 months: daily intervals
    '6mo': '1d',   # 6 months: daily intervals
    '1y': '1wk',   # 1 year: weekly intervals
    '5y': '1mo',   # 5 years: monthly intervals
    'max': '1mo',  # Maximum: monthly intervals
}
