# Backend package initialization
# This file makes the backend directory a proper Python package

from backend.stock_service import (
    stock_service,
    fetch_stock_data,
    process_data,
    add_technical_indicators,
    calculate_metrics,
    calculate_risk_metrics,
    fetch_risk_free_rate,
    fetch_batch_prices,
)

__all__ = [
    "stock_service",
    "fetch_stock_data",
    "process_data",
    "add_technical_indicators",
    "calculate_metrics",
    "calculate_risk_metrics",
    "fetch_risk_free_rate",
    "fetch_batch_prices",
]
