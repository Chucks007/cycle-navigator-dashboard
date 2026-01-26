"""
Common utilities shared across task modules.

Provides database sessions, Redis client, rate limiting, and logging setup.
"""

import logging

import redis
from fredapi import Fred
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.config import (
    COINGECKO_API_KEY,
    DATABASE_URL,
    FRED_API_KEY,
    REDIS_LOCK_TIMEOUT,
    REDIS_URL,
)
from backend.cache_keys import CacheKeys
from backend.services.crypto import CoinGeckoClient

# Logger setup
logger = logging.getLogger(__name__)

# Database setup - lazy initialization
_engine = None
_SessionLocal = None


def get_engine():
    """Get or create database engine (lazy singleton)."""
    global _engine
    if _engine is None:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
    return _engine


def get_session_factory():
    """Get or create session factory (lazy singleton)."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def get_db() -> Session:
    """Get a database session."""
    session_local = get_session_factory()
    return session_local()


# Redis setup - lazy initialization
_redis_client = None


def get_redis_client():
    """Get or create Redis client (lazy singleton)."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


# FRED API client - lazy initialization
_fred_client = None


def get_fred_client():
    """Get or create FRED API client (lazy singleton)."""
    global _fred_client
    if _fred_client is None and FRED_API_KEY:
        _fred_client = Fred(api_key=FRED_API_KEY)
    return _fred_client


# CoinGecko API client - lazy initialization
_coingecko_client = None


def get_coingecko_client():
    """Get or create CoinGecko API client (lazy singleton)."""
    global _coingecko_client
    if _coingecko_client is None and COINGECKO_API_KEY:
        _coingecko_client = CoinGeckoClient(api_key=COINGECKO_API_KEY)
    return _coingecko_client


class RateLimitError(Exception):
    """Raised when API rate limit is hit."""
    pass


def acquire_global_rate_limit_lock(lock_name: str = "rate_limit_lock") -> bool:
    """
    Acquire a global rate-limit lock to prevent concurrent API calls.

    Args:
        lock_name: Name of the lock (allows different locks for different APIs)

    Returns:
        bool: True if lock acquired, False otherwise
    """
    redis_client = get_redis_client()
    lock_key = CacheKeys.rate_limit_lock(lock_name)
    return redis_client.set(lock_key, "1", nx=True, ex=REDIS_LOCK_TIMEOUT)


def release_global_rate_limit_lock(lock_name: str = "rate_limit_lock"):
    """Release a global rate-limit lock."""
    redis_client = get_redis_client()
    lock_key = CacheKeys.rate_limit_lock(lock_name)
    redis_client.delete(lock_key)
