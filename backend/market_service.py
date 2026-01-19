from .services.stock_service import stock_service

# Legacy compatibility: redirect MarketService to StockService
MarketService = type(stock_service)
market_service = stock_service

__all__ = ["MarketService", "market_service", "stock_service"]
