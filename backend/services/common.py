
import logging
from abc import ABC
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

import numpy as np
import pandas as pd

from backend import config

logger = logging.getLogger(__name__)

# Type variable for generic cached data
T = TypeVar("T")


class CachedDataService(ABC):
    """
    Base class for services that use Redis cache with PostgreSQL fallback.
    
    Provides common patterns for:
    - Data staleness checking
    - Cache-first with database fallback
    - Consistent metadata structure
    
    Subclasses should implement their own Redis/DB fetch methods.
    """
    
    def _is_data_stale(self, last_updated: datetime | None) -> bool:
        """
        Check if data is stale based on configured threshold.
        
        Args:
            last_updated: Timestamp of when data was last updated
            
        Returns:
            True if data is stale or last_updated is None
        """
        if not last_updated:
            return True
        
        # Make sure last_updated is timezone-aware for comparison
        if last_updated.tzinfo is None:
            last_updated = last_updated.replace(tzinfo=timezone.utc)
            
        age_hours = (datetime.now(timezone.utc) - last_updated).total_seconds() / 3600
        return age_hours > config.DATA_STALE_THRESHOLD_HOURS
    
    def _get_with_fallback(
        self,
        cache_fn: Callable[[], tuple[T | None, datetime | None]],
        db_fn: Callable[[], tuple[T | None, datetime | None]],
    ) -> tuple[T | None, datetime | None, bool]:
        """
        Fetch data from cache first, falling back to database.
        
        Args:
            cache_fn: Function that returns (data, last_updated) from cache
            db_fn: Function that returns (data, last_updated) from database
            
        Returns:
            Tuple of (data, last_updated, is_stale)
        """
        # Try cache first (fast path)
        data, last_updated = cache_fn()
        
        # Fallback to database if not in cache
        if data is None:
            data, last_updated = db_fn()
        
        # Check staleness
        is_stale = self._is_data_stale(last_updated)
        
        return data, last_updated, is_stale
    
    def _build_metadata(
        self,
        last_updated: datetime | None,
        is_stale: bool,
        error: str | None = None
    ) -> dict[str, Any]:
        """
        Build consistent metadata structure for API responses.
        
        Args:
            last_updated: Timestamp of last data update
            is_stale: Whether the data is considered stale
            error: Optional error message
            
        Returns:
            Metadata dict with last_updated, is_stale, and optional error
        """
        metadata = {
            'last_updated': last_updated.isoformat() if last_updated else None,
            'is_stale': is_stale
        }
        if error:
            metadata['error'] = error
        return metadata
    
    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """
        Parse an ISO format timestamp string and ensure it's timezone-aware.
        
        Args:
            timestamp_str: ISO format timestamp string
            
        Returns:
            Timezone-aware datetime object (UTC if no timezone info present)
        """
        dt = datetime.fromisoformat(timestamp_str)
        if dt.tzinfo is None:
            # Assume UTC if no timezone info
            dt = dt.replace(tzinfo=timezone.utc)
        return dt


def align_dataframes(
    df1: pd.DataFrame,
    df2: pd.DataFrame,
    method: str = 'ffill'
) -> pd.DataFrame:
    """
    Aligns two DataFrames on their index (assumed to be DatetimeIndex).
    Useful for comparing low-frequency Macro data with high-frequency Market data.
    
    Args:
        df1: Primary DataFrame (e.g. Market Data)
        df2: Secondary DataFrame (e.g. Macro Data)
        method: Fill method ('ffill', 'bfill', None). Default 'ffill' propagates last valid observation forward.
    
    Returns:
        Combined DataFrame with aligned index.
    """
    # Ensure indices are datetime if possible
    # We work on copies to avoid side effects if the input is mutable and reused
    d1 = df1.copy()
    d2 = df2.copy()

    if not isinstance(d1.index, pd.DatetimeIndex):
         try:
             d1.index = pd.to_datetime(d1.index)
         except Exception:
             pass

    if not isinstance(d2.index, pd.DatetimeIndex):
         try:
             d2.index = pd.to_datetime(d2.index)
         except Exception:
             pass

    # Merge
    # Outer join to keep all dates from both.
    # Note: If column names collide, join uses lsuffix/rsuffix.
    # But we want to be explicit.
    aligned = d1.join(d2, how='outer', rsuffix='_secondary')

    if method:
        aligned = aligned.ffill() # pandas 2.0+ uses ffill() vs fillna(method='ffill')

    return aligned

def standardize_dataframe(df: pd.DataFrame, timezone: str = 'US/Eastern', reset_index: bool = True) -> pd.DataFrame:
    """
    Standardize DataFrame from financial sources.
    - Handles MultiIndex columns (drops level 1)
    - Timezone conversion (UTC -> target timezone)
    - Reset index (optional, default True) and rename time column to 'date'
    """
    df = df.copy()

    # Handle MultiIndex columns
    if isinstance(df.columns, pd.MultiIndex):
        if df.columns.nlevels == 2:
            df.columns = df.columns.droplevel(1)

    # Timezone conversion
    # Ensure index is DatetimeIndex for this operation
    if isinstance(df.index, pd.DatetimeIndex):
        if df.index.tz is None:
            df.index = df.index.tz_localize('UTC')

        # Convert to target timezone
        # Use simple string for timezone to avoid pytz dependency if not installed,
        # though pandas handles it well usually.
        if timezone:
            try:
                df.index = df.index.tz_convert(timezone)
            except Exception:
                # Fallback if timezone not found or error
                pass

    if reset_index:
        df = df.reset_index()
        # Rename standard index name to 'date' if it comes out as 'Date' or 'index' or 'Datetime'
        # Map common variants to 'date'
        cols = {
            'Date': 'date',
            'Datetime': 'date',
            'index': 'date'
        }
        df = df.rename(columns=cols)

    return df

def format_for_api(df: pd.DataFrame, date_format: str = '%Y-%m-%d') -> list[dict]:
    """
    Format DataFrame for API response.
    - Sort descending by date
    - Handle NaN -> None
    - Format dates to string
    """
    # Create copy to avoid mutating input
    d = df.copy()

    # Ensure 'date' column exists for sorting/formatting
    if 'date' in d.columns:
        # Sort
        d = d.sort_values('date', ascending=False)

        # Format date
        # Check if it's actually datetime
        if pd.api.types.is_datetime64_any_dtype(d['date']):
            d['date'] = d['date'].dt.strftime(date_format)

    # Replace NaN with None
    # We use replace({np.nan: None}) which handles NaNs in float columns
    records = d.replace({np.nan: None}).to_dict(orient='records')
    return records
