import pandas as pd
import ta
import yfinance as yf


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

    data['SMA_20'] = ta.trend.sma_indicator(close_prices, window=20)
    data['EMA_20'] = ta.trend.ema_indicator(close_prices, window=20)
    data['RSI_14'] = ta.momentum.rsi(close_prices, window=14)

    # Fill NaNs to avoid JSON serialization issues (NaN becomes null)
    # For charting, keep NaN to prevent lines from dropping to zero
    if fill_na:
        data.fillna(0, inplace=True)
    return data

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

    return {
        "last_close": last_close,
        "change": change,
        "pct_change": pct_change,
        "high": high,
        "low": low,
        "volume": volume
    }
