"""
Configuration API Router

Exposes non-sensitive application configuration to frontend.
This ensures frontend and backend use consistent settings.
"""

from fastapi import APIRouter

from .. import config, schemas

router = APIRouter(
    prefix="/api",
    tags=["Config"]
)


# Timeframe definitions for chart controls
TIMEFRAMES = [
    schemas.TimeframeConfig(
        id="1D", label="1 Day", days=1,
        period="1d", interval="1m"
    ),
    schemas.TimeframeConfig(
        id="1W", label="1 Week", days=7,
        period="5d", interval="5m"
    ),
    schemas.TimeframeConfig(
        id="1M", label="1 Month", days=30,
        period="1mo", interval="1h"
    ),
    schemas.TimeframeConfig(
        id="6M", label="6 Months", days=180,
        period="6mo", interval="1d"
    ),
    schemas.TimeframeConfig(
        id="1Y", label="1 Year", days=365,
        period="1y", interval="1d"
    ),
    schemas.TimeframeConfig(
        id="5Y", label="5 Years", days=1825,
        period="5y", interval="1wk"
    ),
    schemas.TimeframeConfig(
        id="ALL", label="All Time", days=None,
        period="max", interval="1wk"
    ),
]


@router.get("/config", response_model=schemas.AppConfigResponse)
def get_app_config():
    """
    Returns application configuration.
    
    This endpoint exposes non-sensitive configuration values that the frontend
    needs to stay in sync with the backend. Changes to these values in config.py
    are automatically reflected here.
    
    Use cases:
    - Timeframe options for chart controls
    - Cache TTL for data freshness indicators
    - API rate limits for client-side throttling
    - Chart indicator defaults
    - Market indices and watchlist tickers
    
    Note: Sensitive values (API keys, database URLs) are NOT exposed.
    """
    return schemas.AppConfigResponse(
        version="0.1.0",
        timeframes=TIMEFRAMES,
        cache=schemas.CacheConfig(
            ttl_seconds=config.REDIS_CACHE_TTL,
            stale_threshold_hours=config.DATA_STALE_THRESHOLD_HOURS,
        ),
        api_limits=schemas.ApiLimitsConfig(
            fred_daily_limit=config.FRED_RATE_LIMIT_DAILY,
            coingecko_per_minute=config.COINGECKO_RATE_LIMIT_PER_MINUTE,
        ),
        chart_defaults=schemas.ChartDefaultsConfig(
            sma_window=config.SMA_WINDOW,
            ema_window=config.EMA_WINDOW,
            rsi_window=config.RSI_WINDOW,
            default_ticker=config.DEFAULT_TICKER,
            default_tickers=config.DEFAULT_TICKERS,
        ),
        market_indices=config.MARKET_INDICES,
        watchlist_tickers=config.WATCHLIST_TICKERS,
    )
