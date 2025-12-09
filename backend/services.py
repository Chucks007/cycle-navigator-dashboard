from datetime import datetime, timedelta

import pandas as pd
import ta
import yfinance as yf


def fetch_stock_data(ticker: str, period: str, interval: str) -> pd.DataFrame:
    """
    Fetch stock data based on ticker, period, & interval through Yahoo Finance API.
    Raises Exception if data is empty or fetch fails.
    """
    try:
        end_date = datetime.now()
        if period == '1wk':
            start_date = end_date - timedelta(days=7)
        else:
            # Handle '1d', '5d', '1mo', etc.
            # Simple heuristic for days:
            if period.endswith('d'):
                days = int(period[:-1])
            elif period.endswith('mo'):
                days = int(period[:-2]) * 30
            elif period.endswith('y'):
                days = int(period[:-1]) * 365
            else:
                # Fallback for 'max' or others, though yfinance handles 'max' via period arg usually.
                # But here we are using start/end.
                # Let's stick to the original logic if possible, but the original logic was:
                # start_date = end_date - timedelta(days=int(period[:-1]))
                # which assumes the last char is the unit and the rest is int.
                # '1mo' -> int('1m') -> error.
                # The original code had: int(period[:-1]). This implies it only supported 'd' or 'y' maybe?
                # Wait, the original code supported ['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y', 'max']
                # int('1m') would fail.
                # Let's look at the original code again.
                # "start_date = end_date - timedelta(days=int(period[:-1]))"
                # If period is '1mo', period[:-1] is '1m'. int('1m') raises ValueError.
                # So the original code might have been buggy for '1mo' unless I misread it.
                # Ah, let's just use yfinance's period argument instead of start/end if possible,
                # OR fix the logic.
                # Let's use yfinance's period argument directly, it's more robust.
                pass

        # Using period argument is safer than manual date calculation
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
    data.rename(columns={'Date': 'Datetime'}, inplace=True)
    return data

def add_technical_indicators(data: pd.DataFrame) -> pd.DataFrame:
    """
    Add technical indicators (SMA, EMA, RSI).
    """
    # Fix for dimensionality issue
    close_prices = data['Close'].squeeze()

    data['SMA_20'] = ta.trend.sma_indicator(close_prices, window=20)
    data['EMA_20'] = ta.trend.ema_indicator(close_prices, window=20)
    data['RSI_14'] = ta.momentum.rsi(close_prices, window=14)

    # Fill NaNs to avoid JSON serialization issues (NaN becomes null)
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
