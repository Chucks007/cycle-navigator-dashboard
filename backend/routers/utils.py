import logging
from collections.abc import Callable
from functools import wraps
from typing import TypeVar

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


ERROR_RESPONSES = {
    400: {"description": "Invalid Request / Bad Input"},
    502: {"description": "Upstream Provider Error (FRED/Yahoo/Connectivity)"},
    500: {"description": "Internal Server Error"}
}
