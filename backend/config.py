"""
Configuration constants for the Stock Dashboard application.

This module centralizes all hardcoded values and magic numbers used throughout
the application, making them easier to maintain and adjust.
"""

import json
import os
import logging
from dotenv import load_dotenv

load_dotenv()

# Logger setup
logger = logging.getLogger(__name__)

# Financial Constants
FRED_API_KEY = os.getenv("FRED_API_KEY")

if not FRED_API_KEY:
    logger.warning("FRED_API_KEY not found in configuration. Macro data features will be unavailable.")

# CoinGecko API Configuration
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "CG-d9CPh2wqHw8MMNEiBCaakoE3")

if not COINGECKO_API_KEY:
    logger.warning("COINGECKO_API_KEY not found in configuration. Crypto data features will be unavailable.")

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cycle_user:cycle_password@localhost:5432/cycle_navigator")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Celery Configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

# Cache Configuration
REDIS_CACHE_TTL = 86400  # 24 hours in seconds
REDIS_CACHE_PREFIX = "macro:"
REDIS_CRYPTO_CACHE_PREFIX = "crypto:"
REDIS_LOCK_TIMEOUT = 300  # 5 minutes for rate-limit lock

# Worker Configuration
FRED_RATE_LIMIT_DAILY = 1000  # FRED API limit per day
FRED_SAFE_REQUEST_LIMIT = 800  # Stay well below limit
FRED_RETRY_MAX_ATTEMPTS = 3
FRED_RETRY_BACKOFF_BASE = 2  # Exponential backoff base (2^retry seconds)

# CoinGecko Worker Configuration
COINGECKO_RATE_LIMIT_PER_MINUTE = 30  # Demo API: 30 calls/minute
COINGECKO_RETRY_MAX_ATTEMPTS = 3
COINGECKO_RETRY_BACKOFF_BASE = 2  # Exponential backoff
COINGECKO_HISTORICAL_DAYS_LIMIT = 365  # Demo key provides 365 days of history

# Data Freshness Configuration
DATA_STALE_THRESHOLD_HOURS = 25  # Consider data stale if older than 25 hours
DATA_UPDATE_HOUR = 2  # Update at 2 AM UTC daily

# FRED Series IDs
FRED_SERIES_M2 = 'M2SL'
FRED_SERIES_INTEREST = 'A091RC1Q027SBEA'
FRED_SERIES_TAX = 'W006RC1Q027SBEA'
FRED_SERIES_10Y_YIELD = 'GS10'
FRED_SERIES_CPI = 'CPIAUCSL'

DEFAULT_RISK_FREE_RATE = 0.04  # 4% fallback rate when unable to fetch current rate
TRADING_DAYS_PER_YEAR = 252  # Standard number of trading days per year

# CORS Configuration
CORS_ORIGINS = [
    "http://localhost:5173",  # Vite default port
    "http://localhost:3000",  # Next.js default port
]

# Technical Indicator Settings
SMA_WINDOW = 20  # Simple Moving Average window
EMA_WINDOW = 20  # Exponential Moving Average window
RSI_WINDOW = 14  # Relative Strength Index window

# Dashboard Defaults
DEFAULT_TICKERS = ['AAPL', 'GOOGL', 'AMZN', 'MSFT']  # Real-time stock symbols in sidebar
DEFAULT_TICKER = 'AAPL'  # Default ticker symbol for the main chart

# Mapping logic for time periods to intervals
# Maps user-selected time periods to appropriate data intervals
INTERVAL_MAPPING = {
    '1d': '1m',    # 1 day: 1-minute intervals
    '5d': '5m',    # 5 days: 5-minute intervals
    '1mo': '1h',   # 1 month: hourly intervals
    '3mo': '1d',   # 3 months: daily intervals
    '6mo': '1d',   # 6 months: daily intervals
    '1y': '1wk',   # 1 year: weekly intervals
    '5y': '1mo',   # 5 years: monthly intervals
    'max': '1mo',  # Maximum: monthly intervals
}

# Load S&P 500 companies list for dropdown search
# This list is generated from documents/constituents.csv
_config_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_config_dir)
_companies_file = os.path.join(_project_root, 'top_companies.json')

try:
    with open(_companies_file, 'r') as f:
        TOP_COMPANIES = json.load(f)
except FileNotFoundError:
    # Fallback to empty list if file not found
    TOP_COMPANIES = []

# Market Overview Configuration
MARKET_INDICES = [
    {"ticker": "^GSPC", "name": "S&P 500"},
    {"ticker": "^IXIC", "name": "Nasdaq"},
    {"ticker": "^DJI", "name": "Dow Jones"},
    {"ticker": "BTC-USD", "name": "Bitcoin"}
]

WATCHLIST_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL"]
