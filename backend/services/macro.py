import json
import logging
from datetime import datetime

import pandas as pd
import redis
from fredapi import Fred
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .. import config, schemas
from ..models import FREDSeriesData, FREDSeriesMetadata
from . import common as utils

logger = logging.getLogger(__name__)

# Redis client for caching
redis_client = redis.from_url(config.REDIS_URL, decode_responses=True)

# Database setup for fallback reads
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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

    def _get_series_from_redis(self, series_id: str) -> tuple[pd.Series, datetime]:
        """
        Get series data from Redis cache.
        
        Returns:
            tuple: (pandas Series with data, last_updated datetime) or (None, None) if not found
        """
        cache_key = f"{config.REDIS_CACHE_PREFIX}{series_id}"
        try:
            cached = redis_client.get(cache_key)
            if cached:
                cache_data = json.loads(cached)
                last_updated = datetime.fromisoformat(cache_data['last_updated'])

                # Convert to pandas Series
                data_points = cache_data['data']
                if data_points:
                    dates = [pd.to_datetime(d['date']) for d in data_points]
                    values = [d['value'] for d in data_points]
                    series = pd.Series(values, index=dates)
                    logger.info(f"Retrieved {series_id} from Redis cache (last_updated: {last_updated})")
                    return series, last_updated
        except Exception as e:
            logger.error(f"Error reading {series_id} from Redis: {e}")

        return None, None

    def _get_series_from_db(self, series_id: str) -> tuple[pd.Series, datetime]:
        """
        Get series data from PostgreSQL database as fallback.
        
        Returns:
            tuple: (pandas Series with data, last_updated datetime) or (None, None) if not found
        """
        db = SessionLocal()
        try:
            # Get metadata for last_updated
            metadata = db.query(FREDSeriesMetadata).filter(
                FREDSeriesMetadata.series_id == series_id
            ).first()

            if not metadata:
                return None, None

            # Get series data
            data_records = db.query(FREDSeriesData).filter(
                FREDSeriesData.series_id == series_id
            ).order_by(FREDSeriesData.date).all()

            if not data_records:
                return None, None

            dates = [record.date for record in data_records]
            values = [record.value for record in data_records]
            series = pd.Series(values, index=dates)

            logger.info(f"Retrieved {series_id} from database (last_updated: {metadata.last_fetched})")
            return series, metadata.last_fetched

        except Exception as e:
            logger.error(f"Error reading {series_id} from database: {e}")
            return None, None
        finally:
            db.close()

    def _is_data_stale(self, last_updated: datetime) -> bool:
        """Check if data is stale based on configured threshold."""
        if not last_updated:
            return True
        age_hours = (datetime.utcnow() - last_updated).total_seconds() / 3600
        return age_hours > config.DATA_STALE_THRESHOLD_HOURS

    def _get_series(self, series_id: str) -> tuple[pd.Series, dict]:
        """
        Fetches a series from Redis cache (primary) or PostgreSQL (fallback).
        
        Returns:
            tuple: (pandas Series with data, metadata dict with last_updated and is_stale)
        """
        # Try Redis first (fast cache)
        series, last_updated = self._get_series_from_redis(series_id)

        # Fallback to PostgreSQL if not in Redis
        if series is None:
            logger.warning(f"{series_id} not in Redis, falling back to database")
            series, last_updated = self._get_series_from_db(series_id)

        # If still no data, return empty
        if series is None:
            logger.error(f"No data found for {series_id} in cache or database")
            return pd.Series(dtype=float), {'last_updated': None, 'is_stale': True}

        # Check if data is stale
        is_stale = self._is_data_stale(last_updated)
        if is_stale:
            logger.warning(f"{series_id} data is stale (last_updated: {last_updated})")

        metadata = {
            'last_updated': last_updated.isoformat() if last_updated else None,
            'is_stale': is_stale
        }

        return series, metadata

    def _prepare_macro_response(self, df: pd.DataFrame, metadata: dict, days: int = None) -> tuple[list, dict]:
        """
        Helper to standardize, filter, and format macro data for API response.
        
        Returns:
            tuple: (list of data points, metadata dict with last_updated and is_stale)
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

        return utils.format_for_api(df), metadata

    def get_liquidity(self, days: int = None, include_metadata: bool = False):
        """
        Returns M2 Money Supply and YoY % growth.

        Args:
            days: optional days filter
            include_metadata: if True, return dict with 'data' and 'metadata', otherwise return list of points (legacy)

        Returns:
            Either list[LiquidityPoint] (legacy) or dict{'data', 'metadata'} for API
        """
        res = self._get_series(config.FRED_SERIES_M2) # Billions
        # Backwards-compat: _get_series may return just a pd.Series (tests/mocks), or (series, metadata)
        if isinstance(res, tuple):
            m2, metadata = res
        else:
            m2 = res
            metadata = {'last_updated': None, 'is_stale': True}

        if getattr(m2, 'empty', True):
            return {'data': [], 'metadata': metadata} if include_metadata else []

        # Calculate YoY Growth (12 months)
        m2_growth = m2.pct_change(periods=12)

        # Prepare DataFrame
        df = pd.DataFrame({'value': m2, 'growth_rate': m2_growth})
        df.dropna(inplace=True)

        records, metadata = self._prepare_macro_response(df, metadata, days)
        data_points = [schemas.LiquidityPoint(**r) for r in records]
        return {'data': data_points, 'metadata': metadata} if include_metadata else data_points

    def get_debt_status(self, days: int = None, include_metadata: bool = False):
        """
        Returns Interest-to-Tax ratio and components.

        Args:
            days: optional days filter
            include_metadata: if True, return dict with 'data' and 'metadata', otherwise return legacy list

        Returns:
            Either list[DebtPoint] or dict{'data','metadata'}
        """
        res_interest = self._get_series(config.FRED_SERIES_INTEREST) # Quarterly, Billions
        res_tax = self._get_series(config.FRED_SERIES_TAX)      # Quarterly, Billions

        # Backwards-compat: _get_series may return just a pd.Series
        if isinstance(res_interest, tuple):
            interest, metadata_interest = res_interest
        else:
            interest = res_interest
            metadata_interest = {'last_updated': None, 'is_stale': True}

        if isinstance(res_tax, tuple):
            tax, metadata_tax = res_tax
        else:
            tax = res_tax
            metadata_tax = {'last_updated': None, 'is_stale': True}

        if getattr(interest, 'empty', True) or getattr(tax, 'empty', True):
            # Combine metadata (use the stalest one)
            combined_metadata = metadata_interest if metadata_interest['is_stale'] else metadata_tax
            return {'data': [], 'metadata': combined_metadata} if include_metadata else []

        # Convert to DataFrame for alignment
        df_interest = interest.to_frame(name='interest_payments')
        df_tax = tax.to_frame(name='tax_receipts')

        # Create a common monthly index spanning the overlap
        start_date = max(interest.index.min(), tax.index.min())
        end_date = min(interest.index.max(), tax.index.max())

        if pd.isnull(start_date) or pd.isnull(end_date) or start_date > end_date:
            combined_metadata = metadata_interest if metadata_interest['is_stale'] else metadata_tax
            return {'data': [], 'metadata': combined_metadata} if include_metadata else []

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

        # Combine metadata (both series required, so use the stalest)
        combined_metadata = {
            'last_updated': min(metadata_interest['last_updated'] or '', metadata_tax['last_updated'] or ''),
            'is_stale': metadata_interest['is_stale'] or metadata_tax['is_stale']
        }

        records, _ = self._prepare_macro_response(df, combined_metadata, days)
        data_points = [schemas.DebtPoint(**r) for r in records]
        return {'data': data_points, 'metadata': combined_metadata} if include_metadata else data_points

    def get_real_rates(self, include_metadata: bool = False):
        """
        Returns (10-Year Treasury Yield - CPI Inflation Rate).

        Args:
            include_metadata: if True, return dict with 'data' and 'metadata', otherwise return legacy list
        """
        res_gs10 = self._get_series(config.FRED_SERIES_10Y_YIELD)
        res_cpi = self._get_series(config.FRED_SERIES_CPI)

        if isinstance(res_gs10, tuple):
            gs10, metadata_gs10 = res_gs10
        else:
            gs10 = res_gs10
            metadata_gs10 = {'last_updated': None, 'is_stale': True}

        if isinstance(res_cpi, tuple):
            cpi, metadata_cpi = res_cpi
        else:
            cpi = res_cpi
            metadata_cpi = {'last_updated': None, 'is_stale': True}

        if getattr(gs10, 'empty', True) or getattr(cpi, 'empty', True):
            combined_metadata = metadata_gs10 if metadata_gs10['is_stale'] else metadata_cpi
            return {'data': [], 'metadata': combined_metadata} if include_metadata else []

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

        # Combine metadata
        combined_metadata = {
            'last_updated': min(metadata_gs10['last_updated'] or '', metadata_cpi['last_updated'] or ''),
            'is_stale': metadata_gs10['is_stale'] or metadata_cpi['is_stale']
        }

        records, _ = self._prepare_macro_response(df, combined_metadata)
        data_points = [schemas.RealRatePoint(**r) for r in records]
        return {'data': data_points, 'metadata': combined_metadata} if include_metadata else data_points


    def get_cpi_series(self, include_metadata: bool = False):
        """
        Returns the raw CPI Index series (CPIAUCSL) with metadata.
        
        Args:
            include_metadata: if True, return dict with 'data' and 'metadata', otherwise return legacy list
        """
        res = self._get_series(config.FRED_SERIES_CPI)
        if isinstance(res, tuple):
            cpi, metadata = res
        else:
            cpi = res
            metadata = {'last_updated': None, 'is_stale': True}

        if getattr(cpi, 'empty', True):
            return {'data': [], 'metadata': metadata} if include_metadata else []

        df = pd.DataFrame({'value': cpi})
        df.dropna(inplace=True)

        records, metadata = self._prepare_macro_response(df, metadata)
        data_points = [schemas.CPIPoint(**r) for r in records]
        return {'data': data_points, 'metadata': metadata} if include_metadata else data_points

# Singleton instance
macro_service = MacroService()
