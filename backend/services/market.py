import logging
import functools
from datetime import datetime
import pandas as pd
import backend.services as services
from . import common as utils


logger = logging.getLogger(__name__)

class MarketService:
    @functools.lru_cache(maxsize=32)
    def _fetch_data_cached(self, ticker: str, period: str, interval: str, cache_key: str) -> pd.DataFrame:
        yf = services.get_yf()
        try:
            # yfinance download
            # auto_adjust=True returns 'Close' which is adjusted close, and no 'Adj Close'
            # But standard is usually just download.
            logger.info(f"Fetching {ticker} data from yfinance...")
            df = yf.download(ticker, period=period, interval=interval, progress=False)
            
            if df.empty:
                 logger.warning(f"No data found for {ticker}")
                 return pd.DataFrame()
            return df
        except Exception as e:
            logger.error(f"Error fetching {ticker}: {e}")
            return pd.DataFrame()

    def get_historical_prices(self, ticker: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        # Cache key for 15 minutes (900 seconds)
        cache_key = str(int(datetime.now().timestamp() // 900))
        df = self._fetch_data_cached(ticker, period, interval, cache_key)
        
        if df.empty:
            return df

        # Clean data using shared utility
        # Keep index as DatetimeIndex for subsequent indicator calculations
        return utils.standardize_dataframe(df, reset_index=False)

    def get_indicators(self, ticker: str, period: str = "2y", interval: str = "1wk") -> pd.DataFrame:
        """
        Fetches price data and adds technical indicators.
        Specifically adds 20-period SMA and 21-period EMA for the Bull Market Support Band
        when used with weekly interval.
        """
        df = self.get_historical_prices(ticker, period, interval)
        if df.empty:
            return df

        # We need to work on a copy to avoid implicit modification of cached df if we were returning the cached object directly
        # But pandas operations usually return new series. However, adding columns modifies in place.
        # Since _fetch_data_cached returns a DF that we might be modifying if we didn't copy it in get_historical_prices?
        # lru_cache stores the return value.
        # If I modify the DF returned by lru_cache, I modify the cache.
        # So I must copy it.
        df = df.copy()

        # Calculate Indicators
        # 'Close' is generally the column to use.
        if 'Close' in df.columns:
            # 20-period SMA (20-Week if interval is 1wk)
            df['SMA_20'] = df['Close'].rolling(window=20).mean()
            # 21-period EMA (21-Week if interval is 1wk)
            df['EMA_21'] = df['Close'].ewm(span=21, adjust=False).mean()
        
        return df

market_service = MarketService()
