"""
DEPRECATED: This module has been consolidated into stock_service.py

This file remains as a compatibility stub. All functionality has been moved to
the unified StockService class in backend/services/stock_service.py

For new code, use:
    from backend.services.stock_service import stock_service
    
The MarketService class has been merged into StockService with enhanced caching
and unified technical indicator support.
"""

from .stock_service import stock_service

# Legacy compatibility: MarketService is now StockService
MarketService = type(stock_service)
market_service = stock_service

__all__ = ["MarketService", "market_service", "stock_service"]
