# Backend package initialization
# This file makes the backend directory a proper Python package

from backend.services import (
    fetch_stock_data,
    process_data,
    add_technical_indicators,
    calculate_metrics,
    fetch_risk_free_rate,
)

__all__ = [
    "fetch_stock_data",
    "process_data",
    "add_technical_indicators",
    "calculate_metrics",
    "fetch_risk_free_rate",
]
