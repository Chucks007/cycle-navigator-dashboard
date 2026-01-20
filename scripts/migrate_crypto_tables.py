"""
Database migration script to add crypto tables.

This script creates the crypto_data and crypto_metadata tables
and can be run safely multiple times (idempotent).
"""

import sys
import os

# Add parent directory to path to import backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from backend.models import Base, CryptoData, CryptoMetadata
from backend.config import DATABASE_URL
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    """Create crypto tables in the database."""
    logger.info("Starting crypto tables migration...")
    logger.info(f"Using database: {DATABASE_URL}")
    
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        
        # Create only the crypto tables (Base.metadata.create_all creates all tables,
        # but existing tables are not modified, so this is safe)
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        logger.info("✓ Successfully created crypto_data table")
        logger.info("✓ Successfully created crypto_metadata table")
        logger.info("Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    migrate()
