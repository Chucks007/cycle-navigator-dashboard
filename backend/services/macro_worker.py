"""
Celery worker for background FRED data fetching.

This module implements the background worker that:
1. Fetches data from FRED API on a schedule
2. Stores historical data in PostgreSQL (source of truth)
3. Updates Redis cache for fast frontend access
4. Implements retry logic with exponential backoff
5. Prevents rate-limit violations with global locks
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import redis
from celery import Celery, Task
from celery.schedules import crontab
from fredapi import Fred
import pandas as pd
from sqlalchemy import create_engine, desc
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from backend.config import (
    CELERY_BROKER_URL,
    CELERY_RESULT_BACKEND,
    DATABASE_URL,
    REDIS_URL,
    FRED_API_KEY,
    FRED_SERIES_M2,
    FRED_SERIES_INTEREST,
    FRED_SERIES_TAX,
    FRED_SERIES_10Y_YIELD,
    FRED_SERIES_CPI,
    FRED_RETRY_MAX_ATTEMPTS,
    FRED_RETRY_BACKOFF_BASE,
    REDIS_CACHE_TTL,
    REDIS_CACHE_PREFIX,
    REDIS_LOCK_TIMEOUT,
    DATA_UPDATE_HOUR,
)
from backend.models import Base, FREDSeriesData, FREDSeriesMetadata

# Logger setup
logger = logging.getLogger(__name__)

# Celery app configuration
celery_app = Celery(
    'macro_worker',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

# Database setup
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Redis setup
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# FRED API client
fred_client = Fred(api_key=FRED_API_KEY) if FRED_API_KEY else None

# FRED series to fetch
FRED_SERIES_LIST = [
    FRED_SERIES_M2,
    FRED_SERIES_INTEREST,
    FRED_SERIES_TAX,
    FRED_SERIES_10Y_YIELD,
    FRED_SERIES_CPI,
]


class RateLimitError(Exception):
    """Raised when FRED API rate limit is hit."""
    pass


def get_db() -> Session:
    """Get a database session."""
    return SessionLocal()


def acquire_global_rate_limit_lock() -> bool:
    """
    Acquire a global rate-limit lock to prevent concurrent FRED API calls.
    
    Returns:
        bool: True if lock acquired, False otherwise
    """
    lock_key = f"{REDIS_CACHE_PREFIX}rate_limit_lock"
    return redis_client.set(lock_key, "1", nx=True, ex=REDIS_LOCK_TIMEOUT)


def release_global_rate_limit_lock():
    """Release the global rate-limit lock."""
    lock_key = f"{REDIS_CACHE_PREFIX}rate_limit_lock"
    redis_client.delete(lock_key)


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
    last_observation_date: Optional[datetime] = None,
    status: str = 'success',
    error_message: Optional[str] = None,
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
    
    cache_key = f"{REDIS_CACHE_PREFIX}{series_id}"
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
def fetch_fred_series(self: Task, series_id: str) -> Dict[str, Any]:
    """
    Fetch a single FRED series and store in DB + cache.
    
    Args:
        series_id: FRED series ID to fetch
        
    Returns:
        Dict with status and metadata
    """
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
def update_all_fred_series(self: Task) -> Dict[str, Any]:
    """
    Update all FRED series (scheduled task).
    
    Fetches all required macro indicators from FRED, stores in DB,
    and updates Redis cache. Uses global lock to prevent concurrent runs.
    
    Returns:
        Dict with summary of updates
    """
    if not acquire_global_rate_limit_lock():
        logger.warning("Another update is already in progress, skipping")
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
        release_global_rate_limit_lock()


# Celery Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    'update-fred-data-daily': {
        'task': 'backend.services.macro_worker.update_all_fred_series',
        'schedule': crontab(hour=DATA_UPDATE_HOUR, minute=0),  # Daily at 2 AM UTC
    },
}


# Initialize database tables
def init_db():
    """Create database tables if they don't exist."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized")
    except SQLAlchemyError as e:
        logger.error(f"Error initializing database: {e}")


# Call init_db on module load
init_db()
