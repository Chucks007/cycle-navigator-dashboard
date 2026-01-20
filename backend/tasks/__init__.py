"""
Celery tasks package.

This package contains modular task definitions:
- fred_tasks: FRED API data fetching tasks
- crypto_tasks: CoinGecko API data fetching tasks
- analytics_tasks: Analytics and risk metric calculations
"""

from backend.tasks.analytics_tasks import calculate_risk_metrics
from backend.tasks.crypto_tasks import update_crypto_metrics
from backend.tasks.fred_tasks import fetch_fred_series, update_all_fred_series

__all__ = [
    'fetch_fred_series',
    'update_all_fred_series',
    'update_crypto_metrics',
    'calculate_risk_metrics',
]
