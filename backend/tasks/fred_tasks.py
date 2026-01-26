"""
FRED API data fetching tasks.

Handles fetching macroeconomic data from FRED (Federal Reserve Economic Data),
storing in PostgreSQL, and caching in Redis.
"""

import json
from datetime import datetime
from typing import Any

import pandas as pd
from celery import Task
from sqlalchemy.orm import Session

from backend.celery_app import celery_app
from backend.config import (
    FRED_RETRY_BACKOFF_BASE,
    FRED_RETRY_MAX_ATTEMPTS,
    FRED_SERIES_10Y_YIELD,
    FRED_SERIES_CPI,
    FRED_SERIES_INTEREST,
    FRED_SERIES_M2,
    FRED_SERIES_TAX,
    REDIS_CACHE_TTL,
)
from backend.cache_keys import CacheKeys
from backend.models import FREDSeriesData, FREDSeriesMetadata
from backend.tasks.common import (
    acquire_global_rate_limit_lock,
    get_db,
    get_fred_client,
    get_redis_client,
    logger,
    release_global_rate_limit_lock,
)

# FRED series to fetch
FRED_SERIES_LIST = [
    FRED_SERIES_M2,
    FRED_SERIES_INTEREST,
    FRED_SERIES_TAX,
    FRED_SERIES_10Y_YIELD,
    FRED_SERIES_CPI,
]


def store_series_in_db(db: Session, series_id: str, data: pd.Series) -> int:
    """
    Store FRED series data in PostgreSQL.

    Args:
        db: Database session
        series_id: FRED series ID
        data: Pandas Series with datetime index and values

    Returns:
        int: Number of observations stored
    """
    if data.empty:
        logger.warning(f"No data to store for series {series_id}")
        return 0

    # Delete existing data for this series to avoid duplicates
    db.query(FREDSeriesData).filter(FREDSeriesData.series_id == series_id).delete()

    # Insert new data
    observations = []
    for date, value in data.items():
        if pd.notna(value):  # Skip NaN values
            observations.append(FREDSeriesData(
                series_id=series_id,
                date=date,
                value=float(value),
            ))

    db.bulk_save_objects(observations)
    db.commit()

    logger.info(f"Stored {len(observations)} observations for {series_id}")
    return len(observations)


def update_series_metadata(
    db: Session,
    series_id: str,
    observation_count: int,
    last_observation_date: datetime | None = None,
    status: str = 'success',
    error_message: str | None = None,
):
    """Update metadata for a FRED series."""
    metadata = db.query(FREDSeriesMetadata).filter(
        FREDSeriesMetadata.series_id == series_id
    ).first()

    if metadata:
        metadata.last_fetched = datetime.utcnow()
        metadata.observation_count = observation_count
        metadata.last_observation_date = last_observation_date
        metadata.fetch_status = status
        metadata.error_message = error_message
    else:
        metadata = FREDSeriesMetadata(
            series_id=series_id,
            last_fetched=datetime.utcnow(),
            observation_count=observation_count,
            last_observation_date=last_observation_date,
            fetch_status=status,
            error_message=error_message,
        )
        db.add(metadata)

    db.commit()


def cache_series_in_redis(series_id: str, data: pd.Series):
    """
    Cache FRED series data in Redis for fast access.

    Args:
        series_id: FRED series ID
        data: Pandas Series with datetime index and values
    """
    if data.empty:
        return

    redis_client = get_redis_client()

    # Convert to JSON-serializable format
    cache_data = {
        'series_id': series_id,
        'last_updated': datetime.utcnow().isoformat(),
        'data': [
            {'date': date.isoformat(), 'value': float(value)}
            for date, value in data.items()
            if pd.notna(value)
        ]
    }

    cache_key = CacheKeys.macro_series(series_id)
    redis_client.setex(
        cache_key,
        REDIS_CACHE_TTL,
        json.dumps(cache_data)
    )
    logger.info(f"Cached {series_id} in Redis with {len(cache_data['data'])} points")


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
            update_series_metadata(db, series_id, 0, status='failed', error_message=error_msg)
            return {'status': 'failed', 'error': error_msg}

        # Store in PostgreSQL
        observation_count = store_series_in_db(db, series_id, data)
        last_observation_date = data.index[-1] if not data.empty else None

        # Update metadata
        update_series_metadata(
            db,
            series_id,
            observation_count,
            last_observation_date,
            status='success'
        )

        # Cache in Redis
        cache_series_in_redis(series_id, data)

        return {
            'status': 'success',
            'series_id': series_id,
            'observation_count': observation_count,
            'last_observation_date': last_observation_date.isoformat() if last_observation_date else None,
        }

    except Exception as e:
        error_msg = f"Error fetching {series_id}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        update_series_metadata(db, series_id, 0, status='failed', error_message=error_msg)
        raise
    finally:
        db.close()


@celery_app.task(bind=True)
def update_all_fred_series(self: Task) -> dict[str, Any]:
    """
    Update all FRED series (scheduled task).

    Fetches all required macro indicators from FRED, stores in DB,
    and updates Redis cache. Uses global lock to prevent concurrent runs.

    Returns:
        Dict with summary of updates
    """
    if not acquire_global_rate_limit_lock("fred_rate_limit_lock"):
        logger.warning("Another FRED update is already in progress, skipping")
        return {'status': 'skipped', 'reason': 'concurrent_update'}

    try:
        logger.info("Starting scheduled FRED data update")
        results = []

        for series_id in FRED_SERIES_LIST:
            try:
                result = fetch_fred_series.apply(args=[series_id]).get(timeout=60)
                results.append(result)
                logger.info(f"Updated {series_id}: {result}")
            except Exception as e:
                logger.error(f"Failed to update {series_id}: {e}", exc_info=True)
                results.append({
                    'status': 'failed',
                    'series_id': series_id,
                    'error': str(e)
                })

        success_count = sum(1 for r in results if r.get('status') == 'success')

        return {
            'status': 'completed',
            'total': len(FRED_SERIES_LIST),
            'successful': success_count,
            'failed': len(FRED_SERIES_LIST) - success_count,
            'results': results,
            'timestamp': datetime.utcnow().isoformat(),
        }

    finally:
        release_global_rate_limit_lock("fred_rate_limit_lock")
