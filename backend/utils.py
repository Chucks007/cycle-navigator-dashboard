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
