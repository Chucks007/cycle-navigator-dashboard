"""
Database models package for the cycle navigator dashboard.

This package contains domain-specific SQLAlchemy models organized by business domain:
- macro: FRED economic time series models
- crypto: Cryptocurrency market data models

All models are re-exported here for backward compatibility with existing imports.
"""

from .crypto import CryptoData, CryptoMetadata
from .macro import Base, FREDSeriesData, FREDSeriesMetadata

__all__ = [
    "Base",
    "FREDSeriesData",
    "FREDSeriesMetadata",
    "CryptoData",
    "CryptoMetadata",
]
