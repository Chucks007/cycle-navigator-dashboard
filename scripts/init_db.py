#!/usr/bin/env python3
"""
Database initialization script for Cycle Navigator Dashboard.

This script:
1. Creates database tables from SQLAlchemy models
2. Performs an initial FRED data fetch to populate the cache
3. Validates the setup is working correctly

Run this after starting docker-compose services for the first time.
"""

import sys
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def init_database():
    """Create database tables if they don't exist."""
    try:
        from backend.models import Base
        from sqlalchemy import create_engine
        from backend.config import DATABASE_URL
        
        logger.info("Creating database tables...")
        engine = create_engine(DATABASE_URL)
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Database tables created successfully")
        return True
    except Exception as e:
        logger.error(f"✗ Failed to create database tables: {e}")
        return False


def run_initial_fetch():
    """Run initial FRED data fetch to populate cache."""
    try:
        from backend.services.macro_worker import update_all_fred_series
        
        logger.info("Running initial FRED data fetch...")
        logger.info("This may take a minute as we fetch historical data...")
        
        result = update_all_fred_series()
        
        if result.get('status') == 'completed':
            logger.info(f"✓ Initial data fetch completed:")
            logger.info(f"  - Total series: {result.get('total', 0)}")
            logger.info(f"  - Successful: {result.get('successful', 0)}")
            logger.info(f"  - Failed: {result.get('failed', 0)}")
            
            if result.get('failed', 0) > 0:
                logger.warning("  Some series failed to fetch. Check logs for details.")
                for r in result.get('results', []):
                    if r.get('status') == 'failed':
                        logger.warning(f"    - {r.get('series_id')}: {r.get('error')}")
            
            return result.get('failed', 0) == 0
        else:
            logger.error(f"✗ Initial fetch failed: {result}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Failed to run initial fetch: {e}", exc_info=True)
        return False


def verify_setup():
    """Verify the setup by checking Redis and database."""
    try:
        import redis
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from backend.config import REDIS_URL, DATABASE_URL
        from backend.models import FREDSeriesMetadata
        
        logger.info("Verifying setup...")
        
        # Check Redis connection
        logger.info("Checking Redis connection...")
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
        logger.info("✓ Redis connection OK")
        
        # Check database connection and data
        logger.info("Checking database...")
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        metadata_count = db.query(FREDSeriesMetadata).count()
        logger.info(f"✓ Database connection OK ({metadata_count} series metadata records)")
        
        db.close()
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Verification failed: {e}")
        return False


def main():
    """Main initialization flow."""
    logger.info("=" * 60)
    logger.info("Cycle Navigator Dashboard - Database Initialization")
    logger.info("=" * 60)
    logger.info("")
    
    # Step 1: Create tables
    logger.info("Step 1: Creating database tables")
    if not init_database():
        logger.error("Database initialization failed. Exiting.")
        sys.exit(1)
    logger.info("")
    
    # Step 2: Initial data fetch
    logger.info("Step 2: Fetching initial FRED data")
    if not run_initial_fetch():
        logger.warning("Initial data fetch had errors, but continuing...")
    logger.info("")
    
    # Step 3: Verify setup
    logger.info("Step 3: Verifying setup")
    if not verify_setup():
        logger.error("Setup verification failed. Please check logs.")
        sys.exit(1)
    logger.info("")
    
    logger.info("=" * 60)
    logger.info("✓ Initialization completed successfully!")
    logger.info("=" * 60)
    logger.info("")
    logger.info("Next steps:")
    logger.info("1. The Celery worker will automatically update data daily at 2 AM UTC")
    logger.info("2. The dashboard will load macro data from the cache (sub-100ms)")
    logger.info("3. Monitor metadata.is_stale in API responses for data freshness")
    logger.info("")


if __name__ == "__main__":
    main()
