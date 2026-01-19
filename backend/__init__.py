# Backend package initialization
# This file makes the backend directory a proper Python package

from backend.services.stock_service import (
    stock_service,
)

__all__ = [
    "stock_service",
]
