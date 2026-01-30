"""
FRED API data fetching tasks.

Handles fetching macroeconomic data from FRED (Federal Reserve Economic Data),
storing in PostgreSQL, and caching in Redis.
"""

from datetime import UTC, datetime
from typing import Any

import pandas as pd
from celery import Task

from backend.celery_app import celery_app
from backend.config import (
    FRED_RETRY_BACKOFF_BASE,
    FRED_RETRY_MAX_ATTEMPTS,
    FRED_SERIES_LIST,
)
from backend.services.macro import update_fred_series_data
from backend.tasks.common import (
    acquire_global_rate_limit_lock,
    get_db,
    get_fred_client,
    logger,
    release_global_rate_limit_lock,
)


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': FRED_RETRY_MAX_ATTEMPTS},
    retry_backoff=FRED_RETRY_BACKOFF_BASE,
    retry_backoff_max=600,  # Max 10 minutes
    retry_jitter=True,
)
def fetch_fred_series(self: Task, series_id: str) -> dict[str, Any]:
    """
    Fetch a single FRED series and store in DB + cache.

    Args:
        series_id: FRED series ID to fetch

    Returns:
        Dict with status and metadata
    """
    fred_client = get_fred_client()
    if not fred_client:
        error_msg = "FRED API key not configured"
        logger.error(error_msg)
        return {'status': 'failed', 'error': error_msg}

    db = get_db()
    try:
        # Fetch from FRED API
        logger.info(f"Fetching series {series_id} from FRED API")
        data = fred_client.get_series(series_id)

        if data.empty:
            error_msg = f"No data returned for series {series_id}"
            logger.warning(error_msg)
            # Use shared method to update metadata with failure status
            update_fred_series_data(db, series_id, data, status='failed', error_message=error_msg)
            return {'status': 'failed', 'error': error_msg}

        # Use shared method to store in DB, update metadata, and cache in Redis
        result = update_fred_series_data(db, series_id, data)
        return result

    except Exception as e:
        error_msg = f"Error fetching {series_id}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        # Use shared method to update metadata with failure status
        update_fred_series_data(db, series_id, pd.Series(), status='failed', error_message=error_msg)
        raise
    finally:
        db.close()


@celery_app.task(bind=True)
def update_all_fred_series(self: Task) -> dict[str, Any]:
    """
    Update all FRED series (scheduled task).

    Fetches all required macro indicators from FRED, stores in DB,
    and updates Redis cache. Uses global lock to prevent concurrent runs.
    
    Uses Celery's group() for proper async parallel execution instead of
    blocking .get() calls which violate Celery's async execution model.

    Returns:
        Dict with summary of submitted tasks
    """
    from celery import group

    if not acquire_global_rate_limit_lock("fred_rate_limit_lock"):
        logger.warning("Another FRED update is already in progress, skipping")
        return {'status': 'skipped', 'reason': 'concurrent_update'}

    try:
        logger.info("Starting scheduled FRED data update")

        # Use group() for proper async parallel execution
        # This avoids the anti-pattern of calling .get() inside a task
        job = group(fetch_fred_series.s(series_id) for series_id in FRED_SERIES_LIST)
        result = job.apply_async()

        logger.info(f"Submitted {len(FRED_SERIES_LIST)} FRED fetch tasks (group_id: {result.id})")

        return {
            'status': 'submitted',
            'total': len(FRED_SERIES_LIST),
            'series': FRED_SERIES_LIST,
            'group_id': result.id,
            'timestamp': datetime.now(UTC).isoformat(),
        }

    finally:
        release_global_rate_limit_lock("fred_rate_limit_lock")
