import numpy as np
import pandas as pd
import ta
import logging

from .. import config
from .. import schemas
import backend.services as services
from . import common as common_utils


logger = logging.getLogger(__name__)

# --- Internal Helper Functions for Batch Prices ---

def _fetch_raw_batch_data(tickers: list) -> pd.DataFrame:
    """
    Fetcher: Downloads batch price data for multiple tickers.
    """
    yf = services.get_yf()
    if services.get_yf_import_error() is not None:
        raise Exception(f"yfinance not available: {services.get_yf_import_error()}")


    # Download batch data for 5 days to ensure we have previous close
    data = yf.download(tickers, period="5d", interval="1d", group_by='ticker', auto_adjust=False, progress=False)
    return data

def _calculate_batch_deltas(data: pd.DataFrame, tickers: list) -> dict:
    """
    Processor: Calculates price, delta, and pct_delta for each ticker from batch data.
    """
    results = {}
    for ticker in tickers:
        try:
            # Handle case where only one ticker is requested (structure is different)
            if len(tickers) == 1:
                ticker_data = data
            else:
                if ticker not in data.columns.levels[0]:
                    continue
                ticker_data = data[ticker]

            # Drop NaNs
            ticker_data = ticker_data.dropna()

            if len(ticker_data) < 2:
                # Not enough data for delta
                if len(ticker_data) == 1:
                        last_price = float(ticker_data['Close'].iloc[-1])
                        results[ticker] = {
                        "price": last_price,
                        "delta": 0.0,
                        "pct_delta": 0.0
                    }
                continue

            last_price = float(ticker_data['Close'].iloc[-1])
            prev_price = float(ticker_data['Close'].iloc[-2])

            delta = last_price - prev_price
            pct_delta = (delta / prev_price) * 100

            results[ticker] = {
                "price": last_price,
                "delta": delta,
                "pct_delta": pct_delta
            }
        except Exception:
            # Skip failures for individual tickers in batch
            continue
    return results

# --- Public Services ---

def fetch_stock_data(ticker: str, period: str, interval: str) -> pd.DataFrame:
    """
    Fetch stock data based on ticker, period, & interval through Yahoo Finance API.
    Raises Exception if data is empty or fetch fails.
    """
    yf = services.get_yf()
    error = services.get_yf_import_error()
    if error is not None:
        raise Exception(f"yfinance not available: {error}")


    try:
        if period == 'max':
            data = yf.download(ticker, period='max', interval=interval, auto_adjust=False)
        else:
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
    data = common_utils.standardize_dataframe(data, reset_index=True)
    # Rename 'date' -> 'Datetime' for compatibility with existing schemas
    data = data.rename(columns={'date': 'Datetime'})
    return data


def add_technical_indicators(data: pd.DataFrame, fill_na: bool = True) -> pd.DataFrame:
    """
    Add technical indicators (SMA, EMA, RSI).
    """
    close_prices = data['Close'].squeeze()

    data['SMA_20'] = ta.trend.sma_indicator(close_prices, window=config.SMA_WINDOW)
    data['EMA_20'] = ta.trend.ema_indicator(close_prices, window=config.EMA_WINDOW)
    data['RSI_14'] = ta.momentum.rsi(close_prices, window=config.RSI_WINDOW)

    if fill_na:
        data.fillna(0, inplace=True)
    return data

def fetch_risk_free_rate() -> float:
    """Fetches the current 10-Year Treasury Yield from yfinance."""
    error = utils.get_yf_import_error()
    if error is not None:
        logger.warning(f"Unable to fetch risk-free rate because yfinance import failed: {error}. Using default rate.")
        return config.DEFAULT_RISK_FREE_RATE
    
    yf = utils.get_yf()

    try:
        treasury = yf.Ticker("^TNX")
        hist = treasury.history(period="5d")
        if not hist.empty:
            rate = float(hist['Close'].iloc[-1]) / 100.0
            return rate
        return config.DEFAULT_RISK_FREE_RATE
    except Exception as e:
        logger.warning(f"Unable to fetch risk-free rate: {e}. Using default 4%.")
        return config.DEFAULT_RISK_FREE_RATE

def calculate_risk_metrics(data: pd.DataFrame, risk_free_rate: float = None) -> tuple:
    """
    Calculates Annualized Volatility and Sharpe Ratio.
    Does NOT call API. Pure calculation.
    """
    if risk_free_rate is None:
        risk_free_rate = config.DEFAULT_RISK_FREE_RATE
    
    if data is None or len(data) < 2:
        return np.nan, np.nan

    close_col = data['Close']
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

    volatility = float(returns.std() * np.sqrt(config.TRADING_DAYS_PER_YEAR))
    annualized_return = float(returns.mean() * config.TRADING_DAYS_PER_YEAR)

    if volatility == 0 or np.isnan(volatility):
        sharpe = np.nan
    else:
        sharpe = float((annualized_return - risk_free_rate) / volatility)

    return volatility, sharpe

def calculate_metrics(data: pd.DataFrame, risk_free_rate: float) -> dict:
    """
    Calculate basic metrics from stock data.
    Takes risk_free_rate as input to avoid API calls inside a calculation function.
    """
    last_close = float(data['Close'].iloc[-1].item())
    prev_close = float(data['Close'].iloc[0].item())
    change = last_close - prev_close
    pct_change = (change / prev_close) * 100
    high = float(data['High'].max().item())
    low = float(data['Low'].min().item())
    volume = int(data['Volume'].sum().item())

    volatility, sharpe_ratio = calculate_risk_metrics(data, risk_free_rate)

    return schemas.StockMetrics(
        last_close=last_close,
        change=change,
        pct_change=pct_change,
        high=high,
        low=low,
        volume=volume,
        volatility=volatility,
        sharpe_ratio=sharpe_ratio,
        risk_free_rate=risk_free_rate
    )

def fetch_batch_prices(tickers: list) -> dict:
    """
    Orchestrator: Fetches batch data and calculates price deltas.
    """
    if not tickers:
        return {}

    try:
        raw_data = _fetch_raw_batch_data(tickers)
        results = _calculate_batch_deltas(raw_data, tickers)
        return results
    except Exception as e:
        raise Exception(f"Error fetching batch data: {e}")
