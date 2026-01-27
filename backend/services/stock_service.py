"""
Unified Stock Service for Cycle Navigator Dashboard

This module consolidates stock.py and market.py into a single, high-performance
StockService class. It provides:
- Unified caching strategy for Yahoo Finance API calls
- Technical indicators (SMA, EMA, RSI)
- Risk metrics (Volatility, Sharpe Ratio)
- Batch price fetching for portfolio/sidebar views
- Bull Market Support Band indicators
"""

import functools
import logging
from datetime import datetime

import numpy as np
import pandas as pd
import ta

import backend.services as services

from .. import config, schemas
from . import common as common_utils

logger = logging.getLogger(__name__)


class StockService:
    """
    Unified service for stock data operations.
    
    Implements a class-based singleton pattern with LRU caching to minimize
    redundant Yahoo Finance API calls within a 15-minute window.
    """

    # ==================== Private Fetching Methods ====================

    @functools.lru_cache(maxsize=128)
    def _fetch_data_cached(
        self,
        ticker: str,
        period: str,
        interval: str,
        cache_key: str
    ) -> pd.DataFrame:
        """
        Internal cached fetcher for Yahoo Finance data.
        
        Args:
            ticker: Stock symbol (e.g., 'AAPL')
            period: Time period (e.g., '1d', '1mo', '1y', 'max')
            interval: Data interval (e.g., '1m', '1h', '1d', '1wk')
            cache_key: Timestamp-based key for 15-minute cache buckets
            
        Returns:
            pd.DataFrame: Raw OHLCV data from Yahoo Finance
        """
        yf = services.get_yf()
        error = services.get_yf_import_error()

        if error is not None:
            raise Exception(f"yfinance not available: {error}")

        try:
            logger.info(f"Fetching {ticker} data from yfinance (period={period}, interval={interval})...")

            if period == 'max':
                df = yf.download(ticker, period='max', interval=interval, auto_adjust=False, progress=False)
            else:
                df = yf.download(ticker, period=period, interval=interval, auto_adjust=False, progress=False)

            if df.empty:
                logger.warning(f"No data found for ticker: {ticker}")
                return pd.DataFrame()

            return df

        except Exception as e:
            logger.error(f"Error fetching {ticker}: {e}")
            raise Exception(f"Error fetching data: {e}")

    def _fetch_raw_batch_data(self, tickers: list[str]) -> pd.DataFrame:
        """
        Downloads batch price data for multiple tickers.
        
        Args:
            tickers: List of stock symbols
            
        Returns:
            pd.DataFrame: Batch data grouped by ticker
        """
        yf = services.get_yf()

        if services.get_yf_import_error() is not None:
            raise Exception(f"yfinance not available: {services.get_yf_import_error()}")

        # Download batch data for 5 days to ensure we have previous close
        data = yf.download(
            tickers,
            period="5d",
            interval="1d",
            group_by='ticker',
            auto_adjust=False,
            progress=False
        )
        return data

    def _calculate_batch_deltas(self, data: pd.DataFrame, tickers: list[str]) -> dict:
        """
        Calculates price, delta, and pct_delta for each ticker from batch data.
        
        Args:
            data: Batch DataFrame from yfinance
            tickers: List of tickers to process
            
        Returns:
            dict: Mapping of ticker -> {price, delta, pct_delta}
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

    # ==================== Public Data Fetching Methods ====================

    def get_historical_prices(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Fetches historical price data with standardized formatting.
        
        This is the primary data fetcher with 15-minute caching to prevent
        redundant API calls.
        
        Args:
            ticker: Stock symbol
            period: Time period (default: '1y')
            interval: Data interval (default: '1d')
            
        Returns:
            pd.DataFrame: Standardized OHLCV data with DatetimeIndex
        """
        # Cache key for 15 minutes (900 seconds)
        cache_key = str(int(datetime.now().timestamp() // 900))
        df = self._fetch_data_cached(ticker, period, interval, cache_key)

        if df.empty:
            return df

        # Standardize using shared utility (keeps DatetimeIndex for calculations)
        return common_utils.standardize_dataframe(df, reset_index=False)

    def fetch_stock_data(
        self,
        ticker: str,
        period: str,
        interval: str
    ) -> pd.DataFrame:
        """
        Legacy-compatible wrapper for get_historical_prices.
        
        Raises:
            Exception: If data is empty or fetch fails
        """
        df = self.get_historical_prices(ticker, period, interval)

        if df.empty:
            raise ValueError(f"No data found for {ticker}.")

        return df

    def fetch_batch_prices(self, tickers: list[str]) -> dict:
        """
        Fetches batch data and calculates price deltas for multiple tickers.
        
        Optimized to avoid N+1 API call problems for portfolio/sidebar views.
        
        Args:
            tickers: List of stock symbols
            
        Returns:
            dict: Mapping of ticker -> {price, delta, pct_delta}
        """
        if not tickers:
            return {}

        try:
            raw_data = self._fetch_raw_batch_data(tickers)
            results = self._calculate_batch_deltas(raw_data, tickers)
            return results
        except Exception as e:
            raise Exception(f"Error fetching batch data: {e}")

    # ==================== Data Processing Methods ====================

    def process_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Formats the date & time to ensure timezone awareness with correct formatting.
        
        Args:
            data: Raw DataFrame with DatetimeIndex
            
        Returns:
            pd.DataFrame: Processed DataFrame with 'Datetime' column and standardized index
        """
        data = common_utils.standardize_dataframe(data, reset_index=True)
        # Rename 'date' -> 'Datetime' for compatibility with existing schemas
        data = data.rename(columns={'date': 'Datetime'})
        return data

    # ==================== Technical Indicators ====================

    def add_technical_indicators(
        self,
        data: pd.DataFrame,
        fill_na: bool = True
    ) -> pd.DataFrame:
        """
        Adds standard technical indicators (SMA, EMA, RSI).
        
        Args:
            data: DataFrame with 'Close' column
            fill_na: If True, fill NaN values with 0 (default: True)
            
        Returns:
            pd.DataFrame: DataFrame with additional columns: 'SMA_20', 'EMA_20', 'RSI_14'
        """
        close_prices = data['Close'].squeeze()

        data['SMA_20'] = ta.trend.sma_indicator(close_prices, window=config.SMA_WINDOW)
        data['EMA_20'] = ta.trend.ema_indicator(close_prices, window=config.EMA_WINDOW)
        data['RSI_14'] = ta.momentum.rsi(close_prices, window=config.RSI_WINDOW)

        if fill_na:
            data.fillna(0, inplace=True)

        return data

    def get_indicators(
        self,
        ticker: str,
        period: str = "2y",
        interval: str = "1wk"
    ) -> pd.DataFrame:
        """
        Fetches price data and adds technical indicators.
        
        Specifically adds 20-period SMA and 21-period EMA for the Bull Market 
        Support Band when used with weekly interval.
        
        Args:
            ticker: Stock symbol
            period: Time period (default: '2y' for weekly charts)
            interval: Data interval (default: '1wk')
            
        Returns:
            pd.DataFrame: Price data with SMA_20 and EMA_21 columns
        """
        df = self.get_historical_prices(ticker, period, interval)

        if df.empty:
            return df

        # Must copy to avoid modifying cached data
        df = df.copy()

        # Calculate Bull Market Support Band indicators
        if 'Close' in df.columns:
            # 20-period SMA (20-Week if interval is 1wk)
            df['SMA_20'] = df['Close'].rolling(window=20).mean()
            # 21-period EMA (21-Week if interval is 1wk)
            df['EMA_21'] = df['Close'].ewm(span=21, adjust=False).mean()

        return df

    # ==================== Risk Metrics ====================

    def fetch_risk_free_rate(self) -> float:
        """
        Fetches the current 10-Year Treasury Yield from yfinance.
        
        Returns:
            float: The latest yield as a decimal (e.g. 0.045)
        """
        error = services.get_yf_import_error()

        if error is not None:
            logger.warning(
                f"Unable to fetch risk-free rate because yfinance import failed: {error}. "
                f"Using default rate."
            )
            return config.DEFAULT_RISK_FREE_RATE

        yf = services.get_yf()

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

    def calculate_risk_metrics(
        self,
        data: pd.DataFrame,
        risk_free_rate: float = None
    ) -> tuple[float, float]:
        """
        Calculates Annualized Volatility and Sharpe Ratio.
        
        Pure calculation method - does NOT call API.
        
        Args:
            data: DataFrame with 'Close' column
            risk_free_rate: Risk-free rate as decimal (default: from config)
            
        Returns:
            tuple: (volatility, sharpe_ratio) as floats
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
        returns = close_series.pct_change(fill_method=None).dropna()

        if len(returns) < 2:
            return np.nan, np.nan

        volatility = float(returns.std() * np.sqrt(config.TRADING_DAYS_PER_YEAR))
        annualized_return = float(returns.mean() * config.TRADING_DAYS_PER_YEAR)

        if volatility == 0 or np.isnan(volatility):
            sharpe = np.nan
        else:
            sharpe = float((annualized_return - risk_free_rate) / volatility)

        return volatility, sharpe

    def calculate_metrics(
        self,
        data: pd.DataFrame,
        risk_free_rate: float
    ) -> schemas.StockMetrics:
        """
        Calculates comprehensive stock metrics from price data.
        
        Takes risk_free_rate as input to avoid API calls inside a calculation function.
        
        Args:
            data: DataFrame with OHLCV columns
            risk_free_rate: Risk-free rate for Sharpe calculation
            
        Returns:
            schemas.StockMetrics: Pydantic model with calculated metrics
        """
        last_close = float(data['Close'].iloc[-1].item())
        prev_close = float(data['Close'].iloc[0].item())
        change = last_close - prev_close
        pct_change = (change / prev_close) * 100
        high = float(data['High'].max().item())
        low = float(data['Low'].min().item())
        volume = int(data['Volume'].sum().item())

        volatility, sharpe_ratio = self.calculate_risk_metrics(data, risk_free_rate)

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


# ==================== Singleton Instance ====================

stock_service = StockService()
