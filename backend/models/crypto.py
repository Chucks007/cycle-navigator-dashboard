"""
Database models for cryptocurrency market data.

This module defines SQLAlchemy models for storing global cryptocurrency market data
from CoinGecko API. Tracks total market cap, dominance metrics, and altcoin market cap.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from .macro import Base


class CryptoData(Base):
    """
    Stores global cryptocurrency market data from CoinGecko.
    
    Each row represents a daily snapshot of global crypto metrics including
    total market cap, Bitcoin/Ethereum dominance, and calculated altcoin market cap.
    """
    __tablename__ = 'crypto_data'

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, unique=True, index=True)  # UTC timestamp
    total_mcap = Column(Float, nullable=False)  # Total global market cap in USD
    btc_dominance = Column(Float, nullable=False)  # BTC dominance percentage (0-100)
    eth_dominance = Column(Float, nullable=False)  # ETH dominance percentage (0-100)
    altcoin_mcap = Column(Float, nullable=False)  # Altcoin market cap (Total - BTC - ETH)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<CryptoData(timestamp={self.timestamp}, total_mcap={self.total_mcap:.0f}, btc_dom={self.btc_dominance:.2f}%)>"


class CryptoMetadata(Base):
    """
    Stores metadata about CoinGecko API fetches.
    
    Tracks when global crypto data was last successfully fetched from CoinGecko
    to implement refresh logic and monitor API health.
    """
    __tablename__ = 'crypto_metadata'

    id = Column(Integer, primary_key=True, autoincrement=True)
    metric_type = Column(String(50), nullable=False, unique=True, index=True)  # e.g., 'global', 'top_100'
    last_fetched = Column(DateTime, nullable=False)  # Last successful CoinGecko API fetch
    last_observation_date = Column(DateTime)  # Most recent data point timestamp
    observation_count = Column(Integer, default=0)  # Number of observations in DB
    fetch_status = Column(String(20), default='success')  # 'success', 'failed', 'rate_limited'
    error_message = Column(String(500))  # Last error if fetch failed
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<CryptoMetadata(metric_type='{self.metric_type}', last_fetched={self.last_fetched})>"
