# Backend package initialization
# This file makes the backend directory a proper Python package

from backend.services import (
    fetch_stock_data,
    process_data,
    add_technical_indicators,
    calculate_metrics,
)

__all__ = [
    "fetch_stock_data",
    "process_data",
    "add_technical_indicators",
    "calculate_metrics",
]
