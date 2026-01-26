#!/usr/bin/env python3
"""
Generate synthetic cryptocurrency historical data for development.

This script generates realistic synthetic crypto market data for the past year
when historical data is not available from CoinGecko API. It populates both
PostgreSQL (source of truth) and Redis cache (fast frontend access).

Run this script once during initial setup or to reset crypto data.
"""

import json
import logging
import random
import sys
from datetime import datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_synthetic_crypto_data(days: int = 365) -> list[dict]:
    """
    Generate realistic synthetic crypto market data with variance.
    
    Creates daily snapshots with:
    - Total market cap trending with realistic variance
    - BTC dominance oscillating around 50-55%
    - ETH dominance around 16-20%
    - Calculated altcoin market cap
    
    Args:
        days: Number of days of historical data to generate (default: 365)
        
    Returns:
        List of daily snapshots sorted by timestamp ascending
    """
    logger.info(f"Generating {days} days of synthetic crypto data...")
    
    data_points = []
    base_mcap = 1_200_000_000_000  # $1.2T baseline
    base_btc_dominance = 52.0
    base_eth_dominance = 18.0
    
    end_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    for i in range(days):
        timestamp = end_date - timedelta(days=(days - i - 1))
        
        # Generate realistic variance with some trend
        trend_factor = 1 + (i / days) * 0.3  # 30% growth over the period
        variance = random.uniform(0.85, 1.15)  # ±15% daily variance
        
        total_mcap = base_mcap * trend_factor * variance
        
        # BTC dominance with slight downward trend
        btc_variance = random.uniform(-3, 3)
        btc_trend = -(i / days) * 5  # 5% decrease over period
        btc_dominance = max(45.0, min(60.0, base_btc_dominance + btc_trend + btc_variance))
        
        # ETH dominance with slight upward trend
        eth_variance = random.uniform(-2, 2)
        eth_trend = (i / days) * 3  # 3% increase over period
        eth_dominance = max(14.0, min(22.0, base_eth_dominance + eth_trend + eth_variance))
        
        # Calculate altcoin market cap
        btc_mcap = total_mcap * (btc_dominance / 100)
        eth_mcap = total_mcap * (eth_dominance / 100)
        altcoin_mcap = total_mcap - btc_mcap - eth_mcap
        
        data_points.append({
            'timestamp': timestamp,
            'total_mcap': round(total_mcap, 2),
            'btc_dominance': round(btc_dominance, 2),
            'eth_dominance': round(eth_dominance, 2),
            'altcoin_mcap': round(altcoin_mcap, 2)
        })
    
    logger.info(f"✓ Generated {len(data_points)} synthetic data points")
    logger.info(f"  Date range: {data_points[0]['timestamp'].date()} to {data_points[-1]['timestamp'].date()}")
    logger.info(f"  Market cap range: ${data_points[0]['total_mcap']:,.0f} to ${data_points[-1]['total_mcap']:,.0f}")
    
    return data_points


def seed_crypto_database(data_points: list[dict], force: bool = False) -> bool:
    """
    Populate PostgreSQL database with synthetic crypto data.
    
    Args:
        data_points: List of crypto data snapshots
        force: If True, delete existing data first (default: False)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        from backend.models import CryptoData, CryptoMetadata, Base
        from backend.config import DATABASE_URL
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        
        logger.info("Connecting to database...")
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Check if data already exists
            existing_count = db.query(CryptoData).count()
            
            if existing_count > 0 and not force:
                logger.warning(f"Database already contains {existing_count} crypto records.")
                logger.warning("Use --force to overwrite existing data.")
                return False
            
            if force and existing_count > 0:
                logger.info(f"Deleting {existing_count} existing crypto records...")
                db.query(CryptoData).delete()
                db.commit()
            
            # Insert synthetic data
            logger.info(f"Inserting {len(data_points)} crypto data points...")
            for i, snapshot in enumerate(data_points):
                crypto_data = CryptoData(
                    timestamp=snapshot['timestamp'],
                    total_mcap=snapshot['total_mcap'],
                    btc_dominance=snapshot['btc_dominance'],
                    eth_dominance=snapshot['eth_dominance'],
                    altcoin_mcap=snapshot['altcoin_mcap']
                )
                db.add(crypto_data)
                
                # Commit in batches for performance
                if (i + 1) % 50 == 0:
                    db.commit()
                    logger.info(f"  Committed {i + 1}/{len(data_points)} records...")
            
            db.commit()
            logger.info(f"✓ Successfully inserted {len(data_points)} crypto records")
            
            # Update metadata
            logger.info("Updating crypto metadata...")
            metadata = db.query(CryptoMetadata).filter(
                CryptoMetadata.metric_type == 'global'
            ).first()
            
            if metadata:
                metadata.last_fetched = datetime.utcnow()
                metadata.observation_count = len(data_points)
                metadata.last_observation_date = data_points[-1]['timestamp']
                metadata.fetch_status = 'success'
                metadata.error_message = 'Synthetic data for development'
            else:
                metadata = CryptoMetadata(
                    metric_type='global',
                    last_fetched=datetime.utcnow(),
                    observation_count=len(data_points),
                    last_observation_date=data_points[-1]['timestamp'],
                    fetch_status='success',
                    error_message='Synthetic data for development'
                )
                db.add(metadata)
            
            db.commit()
            logger.info("✓ Crypto metadata updated")
            
            return True
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"✗ Failed to seed database: {e}", exc_info=True)
        return False


def cache_crypto_data_in_redis(data_points: list[dict]) -> bool:
    """
    Cache crypto data in Redis for fast frontend access.
    
    Args:
        data_points: List of crypto data snapshots
        
    Returns:
        True if successful, False otherwise
    """
    try:
        import redis
        from backend.config import REDIS_URL, REDIS_CACHE_TTL
        from backend.cache_keys import CacheKeys
        
        logger.info("Connecting to Redis...")
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        
        # Format data for cache
        cache_data = {
            'last_updated': datetime.utcnow().isoformat(),
            'data': [
                {
                    'timestamp': point['timestamp'].isoformat(),
                    'total_mcap': point['total_mcap'],
                    'btc_dominance': point['btc_dominance'],
                    'eth_dominance': point['eth_dominance'],
                    'altcoin_mcap': point['altcoin_mcap']
                }
                for point in data_points
            ]
        }
        
        cache_key = CacheKeys.crypto_dominance()
        redis_client.setex(
            cache_key,
            REDIS_CACHE_TTL,
            json.dumps(cache_data)
        )
        
        logger.info(f"✓ Cached {len(cache_data['data'])} crypto data points in Redis")
        logger.info(f"  Cache key: {cache_key}")
        logger.info(f"  TTL: {REDIS_CACHE_TTL} seconds ({REDIS_CACHE_TTL / 3600:.1f} hours)")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Failed to cache data in Redis: {e}", exc_info=True)
        return False


def seed_crypto_data(days: int = 365, force: bool = False) -> bool:
    """
    Generate and seed synthetic crypto data to database and Redis.
    
    Main entry point for the script. Generates synthetic data and populates
    both PostgreSQL and Redis to enable the crypto dashboard features.
    
    Args:
        days: Number of days of historical data to generate (default: 365)
        force: If True, overwrite existing data (default: False)
        
    Returns:
        True if successful, False otherwise
    """
    logger.info("=" * 60)
    logger.info("Crypto Data Initialization - Synthetic Data Generation")
    logger.info("=" * 60)
    logger.info("")
    
    # Step 1: Generate synthetic data
    data_points = generate_synthetic_crypto_data(days=days)
    if not data_points:
        logger.error("Failed to generate synthetic data")
        return False
    
    logger.info("")
    
    # Step 2: Seed database
    logger.info("Step 1: Populating PostgreSQL database")
    if not seed_crypto_database(data_points, force=force):
        logger.error("Failed to seed database")
        return False
    
    logger.info("")
    
    # Step 3: Cache in Redis
    logger.info("Step 2: Caching data in Redis")
    if not cache_crypto_data_in_redis(data_points):
        logger.warning("Failed to cache in Redis, but database was populated")
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("✓ Crypto data initialization completed successfully!")
    logger.info("=" * 60)
    logger.info("")
    logger.info("Next steps:")
    logger.info("1. The crypto dashboard is now populated with synthetic data")
    logger.info("2. Use Celery task 'update_crypto_metrics' to fetch real data from CoinGecko")
    logger.info("3. Real data will automatically replace synthetic data over time")
    logger.info("")
    
    return True


def main():
    """CLI entry point with argument parsing."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Generate synthetic crypto data for development",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate 365 days of data (default)
  python scripts/init_crypto_data.py
  
  # Generate 180 days of data
  python scripts/init_crypto_data.py --days 180
  
  # Overwrite existing data
  python scripts/init_crypto_data.py --force
  
  # Generate 90 days and overwrite existing
  python scripts/init_crypto_data.py --days 90 --force
        """
    )
    
    parser.add_argument(
        '--days',
        type=int,
        default=365,
        help='Number of days of historical data to generate (default: 365)'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite existing crypto data in database'
    )
    
    args = parser.parse_args()
    
    # Validate days
    if args.days < 1 or args.days > 3650:
        logger.error("Days must be between 1 and 3650 (10 years)")
        sys.exit(1)
    
    # Run seed process
    success = seed_crypto_data(days=args.days, force=args.force)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
