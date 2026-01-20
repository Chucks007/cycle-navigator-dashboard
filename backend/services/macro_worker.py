"""
Celery worker compatibility shim.

DEPRECATED: This module is maintained for backward compatibility.
New code should import from backend.celery_app and backend.tasks.

Migration guide:
- celery_app -> from backend.celery_app import celery_app
- fetch_fred_series -> from backend.tasks.fred_tasks import fetch_fred_series
- update_all_fred_series -> from backend.tasks.fred_tasks import update_all_fred_series
- update_crypto_metrics -> from backend.tasks.crypto_tasks import update_crypto_metrics
"""

import warnings

# Re-export from new locations for backward compatibility
from backend.celery_app import celery_app
from backend.tasks.fred_tasks import (
    fetch_fred_series,
    update_all_fred_series,
    store_series_in_db,
    update_series_metadata,
    cache_series_in_redis,
    FRED_SERIES_LIST,
)
from backend.tasks.crypto_tasks import (
    update_crypto_metrics,
    store_crypto_data_in_db,
    update_crypto_metadata,
    cache_crypto_dominance_in_redis,
)
from backend.tasks.common import (
    get_db,
    get_redis_client,
    get_fred_client,
    get_coingecko_client,
    acquire_global_rate_limit_lock,
    release_global_rate_limit_lock,
    RateLimitError,
)

# Emit deprecation warning on import
warnings.warn(
    "backend.services.macro_worker is deprecated. "
    "Import from backend.celery_app and backend.tasks instead.",
    DeprecationWarning,
    stacklevel=2
)

# Legacy aliases for backward compatibility
redis_client = None  # Use get_redis_client() instead
fred_client = None   # Use get_fred_client() instead
coingecko_client = None  # Use get_coingecko_client() instead


def init_db():
    """
    Initialize database tables.
    
    DEPRECATED: Use scripts/init_db.py instead.
    This function is kept for backward compatibility but does nothing.
    Database initialization should be done explicitly via init_db.py.
    """
    warnings.warn(
        "init_db() in macro_worker is deprecated. "
        "Use scripts/init_db.py for database initialization.",
        DeprecationWarning,
        stacklevel=2
    )
