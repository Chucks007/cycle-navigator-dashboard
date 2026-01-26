"""
Centralized Redis cache key management.

This module provides a single source of truth for all Redis cache key patterns
used throughout the application. By centralizing key generation, we:
- Prevent typos and inconsistent key patterns
- Make cache keys easy to discover and maintain
- Enable easier cache invalidation and cleanup
- Document key purposes and TTLs in one place

Usage:
    from backend.cache_keys import CacheKeys
    
    # Get a cache key
    key = CacheKeys.macro_series("M2SL")
    
    # Invalidate keys by pattern
    CacheKeys.invalidate_pattern("macro:*")
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class CacheKeys:
    """
    Centralized cache key generation and management.
    
    All Redis keys in the application should be generated through this class
    to ensure consistency and make cache management easier.
    """
    
    # Prefixes for different data types
    _MACRO_PREFIX = "macro:"
    _CRYPTO_PREFIX = "crypto:"
    _LOCK_PREFIX = "lock:"
    
    # =========================================================================
    # FRED/Macro Economic Data Keys
    # =========================================================================
    
    @staticmethod
    def macro_series(series_id: str) -> str:
        """
        Cache key for FRED time series data.
        
        Args:
            series_id: FRED series identifier (e.g., 'M2SL', 'CPIAUCSL')
            
        Returns:
            Redis key for this series
            
        Example:
            >>> CacheKeys.macro_series("M2SL")
            'macro:M2SL'
        """
        return f"{CacheKeys._MACRO_PREFIX}{series_id}"
    
    @staticmethod
    def macro_metadata(series_id: str) -> str:
        """
        Cache key for FRED series metadata (last updated, observation count, etc.).
        
        Args:
            series_id: FRED series identifier
            
        Returns:
            Redis key for metadata
            
        Example:
            >>> CacheKeys.macro_metadata("M2SL")
            'macro:meta:M2SL'
        """
        return f"{CacheKeys._MACRO_PREFIX}meta:{series_id}"
    
    # =========================================================================
    # Cryptocurrency Data Keys
    # =========================================================================
    
    @staticmethod
    def crypto_dominance() -> str:
        """
        Cache key for crypto dominance time series data.
        
        Stores daily snapshots of BTC/ETH dominance and total market cap.
        
        Returns:
            Redis key for crypto dominance data
            
        Example:
            >>> CacheKeys.crypto_dominance()
            'crypto:dominance'
        """
        return f"{CacheKeys._CRYPTO_PREFIX}dominance"
    
    @staticmethod
    def crypto_top_coins(limit: int = 100) -> str:
        """
        Cache key for top N coins by market cap.
        
        Args:
            limit: Number of top coins (default: 100)
            
        Returns:
            Redis key for top coins data
            
        Example:
            >>> CacheKeys.crypto_top_coins(100)
            'crypto:top:100'
        """
        return f"{CacheKeys._CRYPTO_PREFIX}top:{limit}"
    
    @staticmethod
    def crypto_coin_history(coin_id: str, days: int = 365) -> str:
        """
        Cache key for individual coin historical data.
        
        Args:
            coin_id: CoinGecko coin identifier (e.g., 'bitcoin', 'ethereum')
            days: Number of days of history
            
        Returns:
            Redis key for coin history
            
        Example:
            >>> CacheKeys.crypto_coin_history("bitcoin", 365)
            'crypto:history:bitcoin:365'
        """
        return f"{CacheKeys._CRYPTO_PREFIX}history:{coin_id}:{days}"
    
    # =========================================================================
    # Rate Limiting & Lock Keys
    # =========================================================================
    
    @staticmethod
    def rate_limit_lock(lock_name: str = "rate_limit_lock") -> str:
        """
        Cache key for global rate limiting locks.
        
        Used to prevent concurrent API calls that would violate rate limits.
        
        Args:
            lock_name: Name of the lock (allows different locks for different APIs)
            
        Returns:
            Redis key for the lock
            
        Example:
            >>> CacheKeys.rate_limit_lock("fred_api")
            'lock:rate_limit_lock:fred_api'
        """
        return f"{CacheKeys._LOCK_PREFIX}rate_limit_lock:{lock_name}"
    
    @staticmethod
    def task_lock(task_name: str) -> str:
        """
        Cache key for Celery task locks.
        
        Prevents duplicate execution of the same task.
        
        Args:
            task_name: Name of the Celery task
            
        Returns:
            Redis key for the task lock
            
        Example:
            >>> CacheKeys.task_lock("update_crypto_metrics")
            'lock:task:update_crypto_metrics'
        """
        return f"{CacheKeys._LOCK_PREFIX}task:{task_name}"
    
    # =========================================================================
    # Cache Management Utilities
    # =========================================================================
    
    @staticmethod
    def get_pattern_prefix(category: str) -> str:
        """
        Get the Redis key pattern for a category of keys.
        
        Useful for bulk operations like invalidation.
        
        Args:
            category: Key category ('macro', 'crypto', 'lock')
            
        Returns:
            Redis pattern string
            
        Example:
            >>> CacheKeys.get_pattern_prefix("macro")
            'macro:*'
        """
        patterns = {
            'macro': f"{CacheKeys._MACRO_PREFIX}*",
            'crypto': f"{CacheKeys._CRYPTO_PREFIX}*",
            'lock': f"{CacheKeys._LOCK_PREFIX}*",
        }
        return patterns.get(category, "*")
    
    @staticmethod
    def invalidate_pattern(redis_client, pattern: str) -> int:
        """
        Delete all keys matching a pattern.
        
        WARNING: Use with caution in production. This can be slow on large datasets.
        
        Args:
            redis_client: Redis client instance
            pattern: Redis key pattern (supports wildcards)
            
        Returns:
            Number of keys deleted
            
        Example:
            >>> from backend.tasks.common import get_redis_client
            >>> redis_client = get_redis_client()
            >>> CacheKeys.invalidate_pattern(redis_client, "macro:*")
            15
        """
        try:
            # Use SCAN instead of KEYS for better performance
            deleted_count = 0
            cursor = 0
            
            while True:
                cursor, keys = redis_client.scan(
                    cursor=cursor,
                    match=pattern,
                    count=100
                )
                
                if keys:
                    deleted_count += redis_client.delete(*keys)
                
                if cursor == 0:
                    break
            
            logger.info(f"Invalidated {deleted_count} keys matching pattern: {pattern}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error invalidating keys with pattern {pattern}: {e}")
            return 0
    
    @staticmethod
    def invalidate_macro_series(redis_client, series_id: Optional[str] = None) -> int:
        """
        Invalidate macro series cache.
        
        Args:
            redis_client: Redis client instance
            series_id: Specific series to invalidate, or None for all
            
        Returns:
            Number of keys deleted
            
        Example:
            >>> CacheKeys.invalidate_macro_series(redis_client, "M2SL")
            1
            >>> CacheKeys.invalidate_macro_series(redis_client)  # All series
            15
        """
        if series_id:
            key = CacheKeys.macro_series(series_id)
            deleted = redis_client.delete(key)
            logger.info(f"Invalidated macro series: {series_id}")
            return deleted
        else:
            pattern = CacheKeys.get_pattern_prefix("macro")
            return CacheKeys.invalidate_pattern(redis_client, pattern)
    
    @staticmethod
    def invalidate_crypto_data(redis_client) -> int:
        """
        Invalidate all crypto data cache.
        
        Args:
            redis_client: Redis client instance
            
        Returns:
            Number of keys deleted
            
        Example:
            >>> CacheKeys.invalidate_crypto_data(redis_client)
            3
        """
        pattern = CacheKeys.get_pattern_prefix("crypto")
        return CacheKeys.invalidate_pattern(redis_client, pattern)
    
    @staticmethod
    def list_all_keys(redis_client, category: Optional[str] = None) -> list[str]:
        """
        List all cache keys, optionally filtered by category.
        
        Useful for debugging and monitoring cache usage.
        
        Args:
            redis_client: Redis client instance
            category: Filter by category ('macro', 'crypto', 'lock'), or None for all
            
        Returns:
            List of Redis keys
            
        Example:
            >>> CacheKeys.list_all_keys(redis_client, "macro")
            ['macro:M2SL', 'macro:CPIAUCSL', 'macro:meta:M2SL']
        """
        try:
            pattern = CacheKeys.get_pattern_prefix(category) if category else "*"
            keys = []
            cursor = 0
            
            while True:
                cursor, batch = redis_client.scan(
                    cursor=cursor,
                    match=pattern,
                    count=100
                )
                keys.extend(batch)
                
                if cursor == 0:
                    break
            
            return sorted(keys)
            
        except Exception as e:
            logger.error(f"Error listing keys: {e}")
            return []


# Convenience aliases for backward compatibility
REDIS_CACHE_PREFIX = CacheKeys._MACRO_PREFIX
REDIS_CRYPTO_CACHE_PREFIX = CacheKeys._CRYPTO_PREFIX
