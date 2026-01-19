"""
DEPRECATED: This module has been consolidated into stock_service.py

This file remains as a compatibility stub. All functionality has been moved to
the unified StockService class in backend/services/stock_service.py

For new code, use:
    from backend.services.stock_service import stock_service
"""

from .stock_service import stock_service

# Legacy functional interface - redirects to unified service methods
fetch_stock_data = stock_service.fetch_stock_data
process_data = stock_service.process_data
add_technical_indicators = stock_service.add_technical_indicators
calculate_metrics = stock_service.calculate_metrics
calculate_risk_metrics = stock_service.calculate_risk_metrics
fetch_risk_free_rate = stock_service.fetch_risk_free_rate
fetch_batch_prices = stock_service.fetch_batch_prices

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
