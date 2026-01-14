import logging
import functools
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from fredapi import Fred

from .. import config
from .. import schemas
from . import common as utils


logger = logging.getLogger(__name__)

class MacroService:
    def __init__(self):
        self.api_key = config.FRED_API_KEY
        self.fred = None
        if self.api_key:
            try:
                self.fred = Fred(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Fred API: {e}")
        else:
            logger.warning("FRED_API_KEY not found in configuration.")

    @functools.lru_cache(maxsize=32)
    def _get_series_cached(self, series_id: str, cache_key: str) -> pd.Series:
        """
        Calculates or fetches a FRED series, cached by (series_id, date).
        """
        if not self.fred:
            logger.error("Cannot fetch data: FRED API key missing.")
            return pd.Series(dtype=float)

        try:
            logger.info(f"Fetching {series_id} from FRED API...")
            series = self.fred.get_series(series_id)
            return series
        except Exception as e:
            logger.error(f"Error fetching {series_id} from FRED: {e}")
            return pd.Series(dtype=float)

    def _get_series(self, series_id: str) -> pd.Series:
        """
        Fetches a series from FRED with caching.
        """
        # Create a cache key based on current date to invalidate daily
        cache_key = datetime.now().strftime('%Y-%m-%d')
        return self._get_series_cached(series_id, cache_key)

    def _prepare_macro_response(self, df: pd.DataFrame, days: int = None) -> list:
        """
        Helper to standardize, filter, and format macro data for API response.
        """
        # Standardize: Clean MultiIndex, Fix TZ (Keep UTC for Macro), Reset Index -> 'date' col
        df = utils.standardize_dataframe(df, timezone='UTC', reset_index=True)
        
        # Filter by days if provided
        if days and 'date' in df.columns:
            # df['date'] is now UTC aware because of standardize_dataframe
            
            cutoff_date = pd.Timestamp.now(tz='UTC') - pd.Timedelta(days=days)
            
            try:
                df = df[df['date'] >= cutoff_date]
            except TypeError:
                # Fallback if mismatch
                 df = df[df['date'] >= cutoff_date.tz_localize(None)]
        
        return utils.format_for_api(df)

    def get_liquidity(self, days: int = None):
        """
        Returns M2 Money Supply and YoY % growth.
        """
        m2 = self._get_series(config.FRED_SERIES_M2) # Billions
        if m2.empty:
            return []

        # Calculate YoY Growth (12 months)
        m2_growth = m2.pct_change(periods=12)

        # Prepare DataFrame
        df = pd.DataFrame({'value': m2, 'growth_rate': m2_growth})
        df.dropna(inplace=True)
        
        records = self._prepare_macro_response(df, days)
        return [schemas.LiquidityPoint(**r) for r in records]

    def get_debt_status(self, days: int = None):
        """
        Returns Interest-to-Tax ratio and components.
        """
        interest = self._get_series(config.FRED_SERIES_INTEREST) # Quarterly, Billions
        tax = self._get_series(config.FRED_SERIES_TAX)      # Quarterly, Billions

        if interest.empty or tax.empty:
            return []

        # Convert to DataFrame for alignment
        df_interest = interest.to_frame(name='interest_payments')
        df_tax = tax.to_frame(name='tax_receipts')

        # Create a common monthly index spanning the overlap
        start_date = max(interest.index.min(), tax.index.min())
        end_date = min(interest.index.max(), tax.index.max())

        if pd.isnull(start_date) or pd.isnull(end_date) or start_date > end_date:
            return []

        # Generate monthly range target
        monthly_index = pd.date_range(start=start_date, end=end_date, freq='MS')
        df_target = pd.DataFrame(index=monthly_index)

        # Align both series to the monthly target using the helper
        # We align interest first, then align tax to that, or align both to target.
        # Aligning each to target guarantees we get the monthly structure
        
        # Note: We align quartely data to monthly, so we MUST ffill
        aligned = utils.align_dataframes(df_target, df_interest, method='ffill')
        aligned = utils.align_dataframes(aligned, df_tax, method='ffill')

        # Calculate Ratio: (Interest / Tax) * 100
        aligned['ratio'] = (aligned['interest_payments'] / aligned['tax_receipts']) * 100

        # Select columns and drop NaNs
        df = aligned[['interest_payments', 'tax_receipts', 'ratio']].copy()
        df.dropna(inplace=True)
        
        records = self._prepare_macro_response(df, days)
        return [schemas.DebtPoint(**r) for r in records]

    def get_real_rates(self):
        """
        Returns (10-Year Treasury Yield - CPI Inflation Rate).
        """
        gs10 = self._get_series(config.FRED_SERIES_10Y_YIELD)
        cpi = self._get_series(config.FRED_SERIES_CPI)

        if gs10.empty or cpi.empty:
            return []

        # CPI YoY Inflation Rate (Decimal)
        cpi_yoy = cpi.pct_change(periods=12)

        # GS10 is in Percent (e.g. 4.2). Convert to decimal to match CPI YoY
        gs10_decimal = gs10 / 100.0

        # Convert to DataFrames
        df_gs10 = gs10_decimal.to_frame(name='treasury_yield_10y')
        df_cpi = cpi_yoy.to_frame(name='cpi_inflation')

        # Align utilizing the helper 
        aligned = utils.align_dataframes(df_gs10, df_cpi, method='ffill')

        # Real Rate = 10Y Yield - CPI Inflation
        aligned['real_rate'] = aligned['treasury_yield_10y'] - aligned['cpi_inflation']

        df = aligned[['treasury_yield_10y', 'cpi_inflation', 'real_rate']].copy()
        df.dropna(inplace=True)
        
        records = self._prepare_macro_response(df)
        return [schemas.RealRatePoint(**r) for r in records]


    def get_cpi_series(self):
        """
        Returns the raw CPI Index series (CPIAUCSL).
        """
        cpi = self._get_series(config.FRED_SERIES_CPI)
        if cpi.empty:
            return []

        df = pd.DataFrame({'value': cpi})
        df.dropna(inplace=True)
        
        records = self._prepare_macro_response(df)
        return [schemas.CPIPoint(**r) for r in records]

# Singleton instance
macro_service = MacroService()
