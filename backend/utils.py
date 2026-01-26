"""
Backend utilities.

Contains reusable utilities including:
- yfinance wrapper with graceful degradation
- API error handling decorator for FastAPI routers
"""

import logging
from functools import wraps
from types import SimpleNamespace
from typing import Callable, TypeVar

from fastapi import HTTPException
from requests.exceptions import ConnectionError, RequestException, Timeout

logger = logging.getLogger(__name__)

# Type variable for generic decorator
F = TypeVar("F", bound=Callable)


def handle_api_errors(func: F) -> F:
    """
    Decorator for consistent error handling across FastAPI route handlers.
    
    Catches common exception types and converts them to appropriate HTTPExceptions:
    - ValueError -> 400 Bad Request
    - ConnectionError/Timeout/RequestException -> 502 Bad Gateway (upstream error)
    - Exception -> 500 Internal Server Error
    
    Usage:
        @router.get("/endpoint")
        @handle_api_errors
        def my_endpoint():
            return service.do_something()
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValueError as e:
            logger.warning(f"Bad request in {func.__name__}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except (ConnectionError, Timeout, RequestException) as e:
            logger.error(f"Upstream error in {func.__name__}: {e}")
            raise HTTPException(status_code=502, detail=f"Upstream Provider Error: {str(e)}")
        except HTTPException:
            # Re-raise HTTPExceptions as-is (already handled)
            raise
        except Exception:
            logger.exception(f"Unexpected error in {func.__name__}")
            raise HTTPException(status_code=500, detail="Internal Server Error")
    return wrapper  # type: ignore


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


