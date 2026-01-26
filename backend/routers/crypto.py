"""
Crypto API Router

Provides endpoints for cryptocurrency market data from CoinGecko.
All data is cached in Redis and updated daily by the background worker.
"""

import logging

from fastapi import APIRouter, Query

from ..services.crypto import CryptoService
from ..utils import handle_api_errors
from .utils import ERROR_RESPONSES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/crypto",
    tags=["Crypto"]
)

# Initialize crypto service
crypto_service = CryptoService()


@router.get("/dominance", responses=ERROR_RESPONSES)
@handle_api_errors
def get_crypto_dominance(
    days: int = Query(365, description="Number of days of history to return (max 365 for demo key)")
):
    """
    Returns global cryptocurrency market dominance data.
    
    Includes:
    - Total market cap
    - Bitcoin (BTC) dominance percentage
    - Ethereum (ETH) dominance percentage
    - Altcoin market cap (Total - BTC - ETH)
    
    Data is fetched from Redis cache (fast) or PostgreSQL (fallback).
    Background worker updates this daily to avoid rate limits.
    
    Args:
        days: Number of days of historical data (max 365 for demo API key)
    
    Returns:
        {
            'data': List of data points with timestamp, total_mcap, btc_dominance, etc.
            'metadata': {'last_updated': ISO timestamp, 'is_stale': bool}
        }
    """
    return crypto_service.get_dominance(days=days)
