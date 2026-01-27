"""
CoinGecko API data fetching tasks.

Handles fetching cryptocurrency market data from CoinGecko,
storing in PostgreSQL, and caching in Redis.
"""

import json
from datetime import datetime, timedelta, timezone
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
from backend.services.crypto import update_crypto_dominance_data
from backend.tasks.common import (
    get_coingecko_client,
    get_db,
    get_redis_client,
    logger,
)


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
            # Use shared method to update metadata with failure status
            update_crypto_dominance_data(db, None, status='failed', error_message=error_msg)
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
            'timestamp': datetime.now(timezone.utc),
            'total_mcap': total_mcap,
            'btc_dominance': btc_dominance,
            'eth_dominance': eth_dominance,
            'altcoin_mcap': altcoin_mcap
        }

        # Use shared method to store in DB, update metadata, and cache in Redis
        result = update_crypto_dominance_data(db, snapshot)
        
        # Add additional fields to result
        result.update({
            'total_mcap': total_mcap,
            'btc_dominance': btc_dominance,
            'eth_dominance': eth_dominance,
            'altcoin_mcap': altcoin_mcap,
            'timestamp': snapshot['timestamp'].isoformat(),
        })
        
        return result

    except Exception as e:
        error_msg = f"Error updating crypto metrics: {str(e)}"
        logger.error(error_msg, exc_info=True)
        # Use shared method to update metadata with failure status
        update_crypto_dominance_data(db, None, status='failed', error_message=error_msg)
        raise
    finally:
        db.close()
