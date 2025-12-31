import numpy as np
import pandas as pd
import ta
import yfinance as yf

from . import config


def fetch_stock_data(ticker: str, period: str, interval: str) -> pd.DataFrame:
    """
    Fetch stock data based on ticker, period, & interval through Yahoo Finance API.
    Raises Exception if data is empty or fetch fails.
    """
    try:
        # Using yfinance's period argument directly for better reliability
        if period == 'max':
            data = yf.download(ticker, period='max', interval=interval, auto_adjust=False)
        else:
            # Use the period parameter and set auto_adjust explicitly
            data = yf.download(ticker, period=period, interval=interval, auto_adjust=False)

        if data.empty:
            raise ValueError(f"No data found for {ticker}.")
        return data
    except Exception as e:
        raise Exception(f"Error fetching data: {e}")

def process_data(data: pd.DataFrame) -> pd.DataFrame:
    """
    Format the date & time to ensure it is timezone aware with correct formatting.
    """
    if data.index.tz is None:
        data.index = data.index.tz_localize('UTC')
    data.index = data.index.tz_convert('US/Eastern')
    data.reset_index(inplace=True)

    # Flatten MultiIndex columns to simple strings (e.g., ('Close','AAPL') -> 'Close')
    # Drop the ticker suffix so we always have 'Close', 'Open', etc.
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    # Rename index column to 'Datetime' (could be 'Date', 'index', or 'Datetime')
    first_col = data.columns[0]
    if first_col != 'Datetime':
        data.rename(columns={first_col: 'Datetime'}, inplace=True)
    data['Datetime'] = pd.to_datetime(data['Datetime'])

    return data

def add_technical_indicators(data: pd.DataFrame, fill_na: bool = True) -> pd.DataFrame:
    """
    Add technical indicators (SMA, EMA, RSI).
    
    Args:
        data: DataFrame with stock price data including 'Close' column.
        fill_na: If True, fills NaN values with 0 (for API JSON serialization).
                 If False, preserves NaN values (better for charting to avoid
                 lines dropping to zero at the beginning of the time series).
    """
    # Fix for dimensionality issue
    close_prices = data['Close'].squeeze()

    data['SMA_20'] = ta.trend.sma_indicator(close_prices, window=config.SMA_WINDOW)
    data['EMA_20'] = ta.trend.ema_indicator(close_prices, window=config.EMA_WINDOW)
    data['RSI_14'] = ta.momentum.rsi(close_prices, window=config.RSI_WINDOW)

    # Fill NaNs to avoid JSON serialization issues (NaN becomes null)
    # For charting, keep NaN to prevent lines from dropping to zero
    if fill_na:
        data.fillna(0, inplace=True)
    return data

def fetch_risk_free_rate() -> float:
    """Fetches the current 10-Year Treasury Yield from yfinance."""
    try:
        treasury = yf.Ticker("^TNX")
        hist = treasury.history(period="5d")
        if not hist.empty:
            # Get the most recent close price and convert to decimal (e.g., 4.5% -> 0.045)
            rate = float(hist['Close'].iloc[-1]) / 100.0
            return rate
        return config.DEFAULT_RISK_FREE_RATE  # Default to 4% if unable to fetch
    except Exception as e:
        print(f"Unable to fetch risk-free rate: {e}. Using default 4%.")
        return config.DEFAULT_RISK_FREE_RATE

def calculate_risk_metrics(data: pd.DataFrame, risk_free_rate: float = None) -> tuple:
    """
    Calculates Annualized Volatility and Sharpe Ratio.
    data: Pandas DataFrame with a 'Close' column.
    risk_free_rate: Float (e.g., 0.04 for 4%). If None, uses DEFAULT_RISK_FREE_RATE.
    """
    if risk_free_rate is None:
        risk_free_rate = config.DEFAULT_RISK_FREE_RATE
    
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
    volatility = float(returns.std() * np.sqrt(config.TRADING_DAYS_PER_YEAR))

    # Annualized Return (Mean daily return * 252)
    annualized_return = float(returns.mean() * config.TRADING_DAYS_PER_YEAR)

    # Sharpe Ratio (guard against zero/NaN volatility)
    if volatility == 0 or np.isnan(volatility):
        sharpe = np.nan
    else:
        sharpe = float((annualized_return - risk_free_rate) / volatility)

    return volatility, sharpe

def calculate_metrics(data: pd.DataFrame) -> dict:
    """
    Calculate basic metrics from stock data.
    """
    last_close = float(data['Close'].iloc[-1].item())
    prev_close = float(data['Close'].iloc[0].item())
    change = last_close - prev_close
    pct_change = (change / prev_close) * 100
    high = float(data['High'].max().item())
    low = float(data['Low'].min().item())
    volume = int(data['Volume'].sum().item())

    # Calculate risk metrics
    risk_free_rate = fetch_risk_free_rate()
    volatility, sharpe_ratio = calculate_risk_metrics(data, risk_free_rate)

    return {
        "last_close": last_close,
        "change": change,
        "pct_change": pct_change,
        "high": high,
        "low": low,
        "volume": volume,
        "volatility": volatility,
        "sharpe_ratio": sharpe_ratio,
        "risk_free_rate": risk_free_rate
    }
