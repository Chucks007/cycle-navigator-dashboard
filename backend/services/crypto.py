"""
CoinGecko Crypto Service

This module provides the CryptoService class for fetching global cryptocurrency
market data from CoinGecko API. It follows the same caching and persistence patterns
as MacroService: Redis for fast cache, PostgreSQL as source of truth.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import redis
import requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .. import config
from ..cache_keys import CacheKeys
from ..models import CryptoData, CryptoMetadata
from .common import CachedDataService

logger = logging.getLogger(__name__)

# Redis client for caching
redis_client = redis.from_url(config.REDIS_URL, decode_responses=True)

# Database setup for persistence
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class CoinGeckoClient:
    """
    Client for CoinGecko API with rate limiting and error handling.
    """
    BASE_URL = "https://api.coingecko.com/api/v3"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "x-cg-demo-api-key": api_key,
            "Accept": "application/json"
        })

    def get_global_data(self) -> dict | None:
        """
        Fetch global cryptocurrency market data.
        
        Endpoint: GET /global
        Returns total market cap, volume, and dominance percentages.
        """
        try:
            response = self.session.get(f"{self.BASE_URL}/global", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch global crypto data: {e}")
            return None

    def get_top_coins(self, limit: int = 100) -> list[dict] | None:
        """
        Fetch top coins by market cap.
        
        Endpoint: GET /coins/markets
        Used for "Barbell" tracker to analyze top 100 coins.
        """
        try:
            params = {
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": limit,
                "page": 1,
                "sparkline": False
            }
            response = self.session.get(
                f"{self.BASE_URL}/coins/markets",
                params=params,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch top {limit} coins: {e}")
            return None

    def get_coin_history(self, coin_id: str, days: int = 365) -> dict | None:
        """
        Fetch historical price data for a specific coin.
        
        Endpoint: GET /coins/{id}/market_chart
        Used for log-regression analysis and historical charting.
        
        Note: Demo API key limited to 365 days of history.
        """
        try:
            # Ensure we don't exceed demo key limits
            days = min(days, config.COINGECKO_HISTORICAL_DAYS_LIMIT)

            params = {
                "vs_currency": "usd",
                "days": days,
                "interval": "daily"
            }
            response = self.session.get(
                f"{self.BASE_URL}/coins/{coin_id}/market_chart",
                params=params,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch {coin_id} history: {e}")
            return None


class CryptoService(CachedDataService):
    """
    Service for managing cryptocurrency market data with caching and persistence.
    
    Inherits from CachedDataService for common Redis/DB fallback patterns.
    
    Follows MacroService pattern:
    - Redis cache for fast frontend access (<100ms)
    - PostgreSQL for historical data and source of truth
    - Background worker updates data daily to respect rate limits
    """

    def __init__(self):
        self.api_key = config.COINGECKO_API_KEY
        self.client = None
        if self.api_key:
            try:
                self.client = CoinGeckoClient(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize CoinGecko client: {e}")
        else:
            logger.warning("COINGECKO_API_KEY not found in configuration.")

    def _get_dominance_from_redis(self) -> tuple[list[dict] | None, datetime | None]:
        """
        Get dominance data from Redis cache.
        
        Returns:
            tuple: (list of data points, last_updated datetime) or (None, None) if not found
        """
        cache_key = CacheKeys.crypto_dominance()
        try:
            cached = redis_client.get(cache_key)
            if cached:
                cache_data = json.loads(cached)
                last_updated = datetime.fromisoformat(cache_data['last_updated'])
                data_points = cache_data['data']
                logger.info(f"Retrieved crypto dominance from Redis (last_updated: {last_updated})")
                return data_points, last_updated
        except Exception as e:
            logger.error(f"Error reading dominance from Redis: {e}")

        return None, None

    def _get_dominance_from_db(self, days: int = 365) -> tuple[list[dict] | None, datetime | None]:
        """
        Get dominance data from PostgreSQL database as fallback.
        
        Returns:
            tuple: (list of data points, last_updated datetime) or (None, None) if not found
        """
        db = SessionLocal()
        try:
            # Get metadata for last_updated
            metadata = db.query(CryptoMetadata).filter(
                CryptoMetadata.metric_type == 'global'
            ).first()

            if not metadata:
                return None, None

            # Get recent crypto data (limit by days)
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            data_records = db.query(CryptoData).filter(
                CryptoData.timestamp >= cutoff_date
            ).order_by(CryptoData.timestamp).all()

            if not data_records:
                return None, None

            # Format as API response
            data_points = [
                {
                    'timestamp': record.timestamp.isoformat(),
                    'total_mcap': record.total_mcap,
                    'btc_dominance': record.btc_dominance,
                    'eth_dominance': record.eth_dominance,
                    'altcoin_mcap': record.altcoin_mcap
                }
                for record in data_records
            ]

            logger.info(f"Retrieved {len(data_points)} crypto data points from database")
            return data_points, metadata.last_fetched

        except Exception as e:
            logger.error(f"Error reading dominance from database: {e}")
            return None, None
        finally:
            db.close()

    # _is_data_stale is inherited from CachedDataService

    def get_dominance(self, days: int = 365) -> dict:
        """
        Get cryptocurrency dominance data (BTC, ETH, Altcoins).
        
        Returns cached data from Redis (fast) or PostgreSQL (fallback).
        Worker updates this data daily to avoid rate limits.
        
        Args:
            days: Number of days of historical data to return (max 365 for demo key)
        
        Returns:
            dict: {
                'data': list of data points with timestamp, total_mcap, btc_dominance, etc.
                'metadata': {'last_updated': ISO timestamp, 'is_stale': bool}
            }
        """
        # Limit days to demo key constraint
        days = min(days, config.COINGECKO_HISTORICAL_DAYS_LIMIT)

        # Use base class method for cache/DB fallback
        data_points, metadata = self.fetch_data_with_metadata(
            cache_fn=lambda: self._get_dominance_from_redis(),
            db_fn=lambda: self._get_dominance_from_db(days=days),
            error_msg='No data available. Background worker may not have run yet.'
        )

        # If no data found, return empty with error metadata
        if data_points is None:
            logger.error("No dominance data found in cache or database")
            return {
                'data': [],
                'metadata': metadata
            }

        # Filter by days if data came from Redis (DB already filtered)
        # Check if we need to filter (data_points will have timestamps)
        if data_points:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            data_points = [
                point for point in data_points
                if self._parse_timestamp(point['timestamp']) >= cutoff_date
            ]

        # Log warnings for stale data
        if metadata.get('is_stale'):
            logger.warning(f"Dominance data is stale (last_updated: {metadata.get('last_updated')})")

        return {
            'data': data_points,
            'metadata': metadata
        }

    def get_current_snapshot(self) -> dict | None:
        """
        Get current global crypto market snapshot.
        
        This is a utility method for the worker to fetch fresh data from CoinGecko.
        Not intended for direct API use (use get_dominance instead).
        """
        if not self.client:
            logger.error("CoinGecko client not initialized")
            return None

        global_data = self.client.get_global_data()
        if not global_data or 'data' not in global_data:
            return None

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

        return {
            'timestamp': datetime.now(timezone.utc),
            'total_mcap': total_mcap,
            'btc_dominance': btc_dominance,
            'eth_dominance': eth_dominance,
            'altcoin_mcap': altcoin_mcap
        }


def fetch_crypto_dominance_sync() -> dict[str, Any]:
    """
    Synchronous crypto dominance fetch for initialization.
    
    Fetches global crypto data directly without using Celery tasks.
    Used during application startup to populate the cache.
    
    Returns:
        Dict with status and crypto data or error
    """
    from backend.cache_keys import CacheKeys
    
    if not config.COINGECKO_API_KEY:
        logger.error("COINGECKO_API_KEY not configured, cannot fetch crypto data")
        return {
            'status': 'failed',
            'error': 'COINGECKO_API_KEY not configured'
        }
    
    client = CoinGeckoClient(api_key=config.COINGECKO_API_KEY)
    db = SessionLocal()
    
    try:
        logger.info("Fetching global crypto data from CoinGecko API (sync)")
        global_data = client.get_global_data()
        
        if not global_data or 'data' not in global_data:
            logger.warning("No data returned from CoinGecko API")
            return {
                'status': 'failed',
                'error': 'No data returned from CoinGecko API'
            }
        
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
        
        # Check if data for this timestamp already exists (within same hour)
        existing = db.query(CryptoData).filter(
            CryptoData.timestamp >= snapshot['timestamp'].replace(minute=0, second=0, microsecond=0)
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
        
        # Update metadata
        metadata = db.query(CryptoMetadata).filter(
            CryptoMetadata.metric_type == 'global'
        ).first()
        
        if metadata:
            metadata.last_fetched = datetime.utcnow()
            metadata.observation_count = 1
            metadata.last_observation_date = snapshot['timestamp']
            metadata.fetch_status = 'success'
            metadata.error_message = None
        else:
            metadata = CryptoMetadata(
                metric_type='global',
                last_fetched=datetime.utcnow(),
                observation_count=1,
                last_observation_date=snapshot['timestamp'],
                fetch_status='success',
                error_message=None
            )
            db.add(metadata)
        
        db.commit()
        
        # Cache in Redis
        cutoff_date = datetime.utcnow() - timedelta(days=365)
        data_records = db.query(CryptoData).filter(
            CryptoData.timestamp >= cutoff_date
        ).order_by(CryptoData.timestamp).all()
        
        if data_records:
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
                config.REDIS_CACHE_TTL,
                json.dumps(cache_data)
            )
            logger.info(f"Cached {len(cache_data['data'])} crypto data points in Redis")
        
        logger.info(f"✓ Fetched crypto dominance: BTC {btc_dominance:.2f}%, ETH {eth_dominance:.2f}%")
        
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
        logger.error(f"Failed to fetch crypto dominance: {e}")
        db.rollback()
        return {
            'status': 'failed',
            'error': str(e)
        }
    finally:
        db.close()
