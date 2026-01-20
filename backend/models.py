"""
Database models for FRED series storage.

This module defines SQLAlchemy models for storing historical FRED time series data
in PostgreSQL as the source of truth. The worker fetches from FRED, stores in DB,
and updates Redis cache for fast frontend access.
"""

from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, Index
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class FREDSeriesData(Base):
    """
    Stores individual observations for FRED time series.
    
    Each row represents one data point (date + value) for a specific FRED series.
    This allows us to store historical data without re-fetching from FRED API.
    """
    __tablename__ = 'fred_series_data'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    series_id = Column(String(50), nullable=False, index=True)  # e.g., 'M2SL', 'CPIAUCSL'
    date = Column(DateTime, nullable=False, index=True)  # Observation date
    value = Column(Float, nullable=False)  # Series value
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Composite index for efficient queries by series and date range
    __table_args__ = (
        Index('ix_fred_series_date', 'series_id', 'date'),
    )
    
    def __repr__(self):
        return f"<FREDSeriesData(series_id='{self.series_id}', date={self.date}, value={self.value})>"


class FREDSeriesMetadata(Base):
    """
    Stores metadata about FRED series updates.
    
    Tracks when each series was last successfully fetched from FRED API
    to implement smart refresh logic and prevent unnecessary API calls.
    """
    __tablename__ = 'fred_series_metadata'
    
    series_id = Column(String(50), primary_key=True)  # e.g., 'M2SL', 'CPIAUCSL'
    last_fetched = Column(DateTime, nullable=False)  # Last successful FRED API fetch
    last_observation_date = Column(DateTime)  # Most recent data point date
    observation_count = Column(Integer, default=0)  # Number of observations in DB
    fetch_status = Column(String(20), default='success')  # 'success', 'failed', 'rate_limited'
    error_message = Column(String(500))  # Last error if fetch failed
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<FREDSeriesMetadata(series_id='{self.series_id}', last_fetched={self.last_fetched})>"
