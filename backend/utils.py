from types import SimpleNamespace

# yfinance may fail to import on newer Python/protobuf combos (e.g., Python 3.14)
# Wrap import to surface the error but allow module import to succeed for testing
try:
    import yfinance as yf
    _yf_import_error = None
except Exception as e:
    # Create a simple stub so tests can patch attributes like yf.download or yf.Ticker
    def _stub_download(*args, **kwargs):
        raise ImportError("yfinance not available: \"download\" called on stub")

    def _stub_Ticker(*args, **kwargs):
        raise ImportError("yfinance not available: \"Ticker\" called on stub")

    yf = SimpleNamespace(download=_stub_download, Ticker=_stub_Ticker)
    _yf_import_error = e

def get_yf():
    """Returns the yfinance module or the stub."""
    return yf

def get_yf_import_error():
    """Returns the import error if yfinance failed to load, else None."""
    return _yf_import_error

import pandas as pd
import numpy as np
from typing import List, Dict, Optional

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

def format_for_api(df: pd.DataFrame, date_format: str = '%Y-%m-%d') -> List[Dict]:
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

