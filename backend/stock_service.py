from .services.stock_service import stock_service

# Legacy functional interface for backward compatibility
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
