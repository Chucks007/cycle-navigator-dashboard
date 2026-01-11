import logging
import functools
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from fredapi import Fred

from . import config
from . import schemas

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

    def _align_to_monthly(self, target_monthly_index: pd.DatetimeIndex, quarterly_series: pd.Series) -> pd.Series:
        """
        Aligns quarterly data to a monthly index using forward filling.
        """
        if quarterly_series.empty:
            return pd.Series(index=target_monthly_index, data=np.nan)
        
        # Reindex to the monthly index, then forward fill
        # We assume quarterly data points correspond to the start or end of quarter.
        # Forward fill computes the value for subsequent months.
        aligned = quarterly_series.reindex(target_monthly_index, method='ffill')
        return aligned

    def get_liquidity(self, days: int = None):
        """
        Returns M2 Money Supply and YoY % growth.
        """
        m2 = self._get_series('M2SL') # Billions
        if m2.empty:
            return {}

        # Calculate YoY Growth (12 months)
        # Growth should be decimal (e.g. 0.05 for 5%)
        m2_growth = m2.pct_change(periods=12)

        # Prepare DataFrame for JSON response
        df = pd.DataFrame({'value': m2, 'growth_rate': m2_growth})
        df.dropna(inplace=True)
        
        # Reset index to make date a column
        df.reset_index(inplace=True)
        df.columns = ['date', 'value', 'growth_rate']
        
        # Sort by date descending
        df.sort_values('date', ascending=False, inplace=True)

        # Filter by days if provided
        if days:
            cutoff_date = datetime.now() - timedelta(days=days)
            df = df[df['date'] >= cutoff_date]
        
        # Format dates
        df['date'] = df['date'].dt.strftime('%Y-%m-%d')
        
        # Replace NaN with None for Pydantic compatibility
        records = df.replace({np.nan: None}).to_dict(orient='records')
        return [schemas.LiquidityPoint(**r) for r in records]

    def get_debt_status(self, days: int = None):
        """
        Returns Interest-to-Tax ratio and components.
        Aligns Quarterly data to Monthly for consistency if needed, 
        but calculating on Quarterly availability is safer for the ratio itself.
        However, to plot on same timeline as others, we might want monthly.
        Let's provide the raw quarterly aligned to monthly availability.
        """
        interest = self._get_series('A091RC1Q027SBEA') # Quarterly, Billions
        tax = self._get_series('W006RC1Q027SBEA')      # Quarterly, Billions

        if interest.empty or tax.empty:
            return {}

        # Create a common monthly index spanning the overlap
        start_date = max(interest.index.min(), tax.index.min())
        end_date = min(interest.index.max(), tax.index.max())
        
        # We'll use the Interest index as base if we want quarterly output,
        # but the requirements mention "Frequency Alignment: ... align quarterly ... with monthly".
        # So let's generate a monthly range.
        monthly_index = pd.date_range(start=start_date, end=end_date, freq='MS')
        
        interest_aligned = self._align_to_monthly(monthly_index, interest)
        tax_aligned = self._align_to_monthly(monthly_index, tax)
        
        # Calculate Ratio: (Interest / Tax) * 100
        # The prompt says: "Logic: (Interest Payments / Tax Receipts) * 100"
        ratio = (interest_aligned / tax_aligned) * 100

        df = pd.DataFrame({
            'interest_payments': interest_aligned,
            'tax_receipts': tax_aligned,
            'ratio': ratio
        })
        df.dropna(inplace=True)
        df.reset_index(inplace=True)
        df.columns = ['date', 'interest_payments', 'tax_receipts', 'ratio']
        df.sort_values('date', ascending=False, inplace=True)

        # Filter by days if provided
        if days:
            cutoff_date = datetime.now() - timedelta(days=days)
            df = df[df['date'] >= cutoff_date]

        df['date'] = df['date'].dt.strftime('%Y-%m-%d')
        
        records = df.replace({np.nan: None}).to_dict(orient='records')
        return [schemas.DebtPoint(**r) for r in records]

    def get_real_rates(self):
        """
        Returns (10-Year Treasury Yield - CPI Inflation Rate).
        """
        # GS10 is Monthly 10-Year Treasury Constant Maturity Rate (Percent)
        # If user insisted on DGS10 (Daily), we would need to resample. 
        # Using GS10 for monthly alignment.
        gs10 = self._get_series('GS10') 
        cpi = self._get_series('CPIAUCSL')

        if gs10.empty or cpi.empty:
            return {}

        # CPI YoY Inflation Rate (Decimal)
        cpi_yoy = cpi.pct_change(periods=12)

        # GS10 is in Percent (e.g. 4.2). Convert to decimal to match CPI YoY?
        # "Percentage Handling: Ensure inflation and growth rates are returned as decimals"
        # If GS10 is 4.2 (percent), decimal is 0.042.
        gs10_decimal = gs10 / 100.0

        # Align series to common index
        common_index = gs10_decimal.index.intersection(cpi_yoy.index)
        gs10_aligned = gs10_decimal.loc[common_index]
        cpi_aligned = cpi_yoy.loc[common_index]

        # Real Rate = 10Y Yield - CPI Inflation
        real_rate = gs10_aligned - cpi_aligned

        df = pd.DataFrame({
            'treasury_yield_10y': gs10_aligned,
            'cpi_inflation': cpi_aligned,
            'real_rate': real_rate
        })
        df.dropna(inplace=True)
        df.reset_index(inplace=True)
        df.columns = ['date', 'treasury_yield_10y', 'cpi_inflation', 'real_rate']
        df.sort_values('date', ascending=False, inplace=True)
        df['date'] = df['date'].dt.strftime('%Y-%m-%d')

        records = df.replace({np.nan: None}).to_dict(orient='records')
        return [schemas.RealRatePoint(**r) for r in records]


    def get_cpi_series(self):
        """
        Returns the raw CPI Index series (CPIAUCSL).
        """
        cpi = self._get_series('CPIAUCSL')
        if cpi.empty:
            return []

        df = pd.DataFrame({'value': cpi})
        df.dropna(inplace=True)
        df.reset_index(inplace=True)
        df.columns = ['date', 'value']
        df.sort_values('date', ascending=False, inplace=True)
        # Keep date as datetime for easier merging or convert? 
        # API usually returns JSON strings, but internal usage might prefer datetime.
        # Let's keep consistent with other methods -> str for API, but we might need datetime helper for frontend.
        df['date'] = df['date'].dt.strftime('%Y-%m-%d')
        
        records = df.replace({np.nan: None}).to_dict(orient='records')
        return [schemas.CPIPoint(**r) for r in records]

# Singleton instance
macro_service = MacroService()
