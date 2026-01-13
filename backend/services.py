"""
Shim module to expose yfinance helpers under `backend.services`.

Some tests patch `backend.services.get_yf_import_error`, so provide
a thin wrapper around `backend.utils` to maintain compatibility.
"""
from .utils import get_yf, get_yf_import_error, yf

__all__ = ["get_yf", "get_yf_import_error", "yf"]
