"""
CoinGecko API data fetching tasks.

Handles fetching cryptocurrency market data from CoinGecko,
storing in PostgreSQL, and caching in Redis.
"""

import json
from datetime import datetime, timedelta
from typing import Any

from celery import Task
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.celery_app import celery_app
from backend.config import (
    COINGECKO_RETRY_BACKOFF_BASE,
    COINGECKO_RETRY_MAX_ATTEMPTS,
    REDIS_CACHE_TTL,
)
from backend.cache_keys import CacheKeys
from backend.models import CryptoData, CryptoMetadata
from backend.tasks.common import (
    get_coingecko_client,
    get_db,
    get_redis_client,
    logger,
)


def store_crypto_data_in_db(db: Session, snapshot: dict[str, Any]) -> int:
    """
    Store crypto market snapshot in PostgreSQL.

    Args:
        db: Database session
        snapshot: Dict with timestamp, total_mcap, btc_dominance, eth_dominance, altcoin_mcap

    Returns:
        int: Number of records stored (1)
    """
    try:
        # Check if data for this timestamp already exists
        existing = db.query(CryptoData).filter(
            CryptoData.timestamp == snapshot['timestamp']
        ).first()

        if existing:
            # Update existing record
            existing.total_mcap = snapshot['total_mcap']
            existing.btc_dominance = snapshot['btc_dominance']
            existing.eth_dominance = snapshot['eth_dominance']
            existing.altcoin_mcap = snapshot['altcoin_mcap']
            existing.updated_at = datetime.utcnow()
            logger.info(f"Updated existing crypto data for {snapshot['timestamp']}")
        else:
            # Insert new record
            crypto_data = CryptoData(
                timestamp=snapshot['timestamp'],
                total_mcap=snapshot['total_mcap'],
                btc_dominance=snapshot['btc_dominance'],
                eth_dominance=snapshot['eth_dominance'],
                altcoin_mcap=snapshot['altcoin_mcap']
            )
            db.add(crypto_data)
            logger.info(f"Inserted new crypto data for {snapshot['timestamp']}")

        db.commit()
        return 1

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error storing crypto data in DB: {e}")
        raise


def update_crypto_metadata(
    db: Session,
    metric_type: str,
    observation_count: int,
    last_observation_date: datetime | None = None,
    status: str = 'success',
    error_message: str | None = None
):
    """Update crypto metadata after fetch."""
    try:
        metadata = db.query(CryptoMetadata).filter(
            CryptoMetadata.metric_type == metric_type
        ).first()

        if metadata:
            metadata.last_fetched = datetime.utcnow()
            metadata.observation_count = observation_count
            metadata.last_observation_date = last_observation_date
            metadata.fetch_status = status
            metadata.error_message = error_message
        else:
            metadata = CryptoMetadata(
                metric_type=metric_type,
                last_fetched=datetime.utcnow(),
                observation_count=observation_count,
                last_observation_date=last_observation_date,
                fetch_status=status,
                error_message=error_message
            )
            db.add(metadata)

        db.commit()

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating crypto metadata: {e}")


def cache_crypto_dominance_in_redis(db: Session):
    """
    Cache recent crypto dominance data in Redis for fast frontend access.

    Fetches last 365 days from PostgreSQL and caches as JSON.
    """
    try:
        redis_client = get_redis_client()

        # Get last 365 days of data
        cutoff_date = datetime.utcnow() - timedelta(days=365)
        data_records = db.query(CryptoData).filter(
            CryptoData.timestamp >= cutoff_date
        ).order_by(CryptoData.timestamp).all()

        if not data_records:
            logger.warning("No crypto data to cache in Redis")
            return

        # Format for cache
        cache_data = {
            'last_updated': datetime.utcnow().isoformat(),
            'data': [
                {
                    'timestamp': record.timestamp.isoformat(),
                    'total_mcap': record.total_mcap,
                    'btc_dominance': record.btc_dominance,
                    'eth_dominance': record.eth_dominance,
                    'altcoin_mcap': record.altcoin_mcap
                }
                for record in data_records
            ]
        }

        cache_key = CacheKeys.crypto_dominance()
        redis_client.setex(
            cache_key,
            REDIS_CACHE_TTL,
            json.dumps(cache_data)
        )
        logger.info(f"Cached {len(cache_data['data'])} crypto data points in Redis")

    except Exception as e:
        logger.error(f"Error caching crypto data in Redis: {e}")


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': COINGECKO_RETRY_MAX_ATTEMPTS},
    retry_backoff=COINGECKO_RETRY_BACKOFF_BASE,
    retry_backoff_max=600,  # Max 10 minutes
    retry_jitter=True,
)
def update_crypto_metrics(self: Task) -> dict[str, Any]:
    """
    Fetch global crypto market data from CoinGecko and store in DB + cache.

    This task is designed to run daily to avoid burning CoinGecko API credits.
    It fetches current global market data (total mcap, BTC/ETH dominance),
    calculates altcoin market cap, and stores everything in PostgreSQL + Redis.

    Returns:
        Dict with status and metadata
    """
    coingecko_client = get_coingecko_client()
    if not coingecko_client:
        error_msg = "CoinGecko API key not configured"
        logger.error(error_msg)
        return {'status': 'failed', 'error': error_msg}

    db = get_db()
    try:
        # Fetch global data from CoinGecko
        logger.info("Fetching global crypto data from CoinGecko API")
        global_data = coingecko_client.get_global_data()

        if not global_data or 'data' not in global_data:
            error_msg = "No data returned from CoinGecko API"
            logger.warning(error_msg)
            update_crypto_metadata(db, 'global', 0, status='failed', error_message=error_msg)
            return {'status': 'failed', 'error': error_msg}

        data = global_data['data']

        # Extract dominance percentages
        btc_dominance = data.get('market_cap_percentage', {}).get('btc', 0.0)
        eth_dominance = data.get('market_cap_percentage', {}).get('eth', 0.0)

        # Get total market cap in USD
        total_mcap = data.get('total_market_cap', {}).get('usd', 0.0)

        # Calculate altcoin market cap (Total - BTC - ETH)
        btc_mcap = total_mcap * (btc_dominance / 100.0)
        eth_mcap = total_mcap * (eth_dominance / 100.0)
        altcoin_mcap = total_mcap - btc_mcap - eth_mcap

        # Create snapshot
        snapshot = {
            'timestamp': datetime.utcnow(),
            'total_mcap': total_mcap,
            'btc_dominance': btc_dominance,
            'eth_dominance': eth_dominance,
            'altcoin_mcap': altcoin_mcap
        }

        # Store in PostgreSQL
        store_crypto_data_in_db(db, snapshot)

        # Update metadata
        update_crypto_metadata(
            db,
            'global',
            observation_count=1,
            last_observation_date=snapshot['timestamp'],
            status='success'
        )

        # Cache in Redis
        cache_crypto_dominance_in_redis(db)

        return {
            'status': 'success',
            'metric_type': 'global',
            'total_mcap': total_mcap,
            'btc_dominance': btc_dominance,
            'eth_dominance': eth_dominance,
            'altcoin_mcap': altcoin_mcap,
            'timestamp': snapshot['timestamp'].isoformat(),
        }

    except Exception as e:
        error_msg = f"Error updating crypto metrics: {str(e)}"
        logger.error(error_msg, exc_info=True)
        update_crypto_metadata(db, 'global', 0, status='failed', error_message=error_msg)
        raise
    finally:
        db.close()
