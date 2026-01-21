"""
Cache initialization script.

Runs on application startup to populate Redis cache with initial data.
This ensures the dashboard has data ready when users first access it.
"""

import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_cache():
    """Populate Redis cache with FRED and crypto data on startup."""
    logger.info("=" * 60)
    logger.info("Initializing application cache...")
    logger.info("=" * 60)
    
    try:
        # Import celery app and tasks
        from backend.celery_app import celery_app
        from backend.tasks.fred_tasks import update_all_fred_series
        from backend.tasks.crypto_tasks import update_crypto_metrics
        
        # Fetch FRED macro data
        logger.info("Fetching FRED macro series...")
        try:
            fred_task = update_all_fred_series.apply_async()
            fred_result = fred_task.get(timeout=120)
            
            if fred_result.get('status') == 'completed':
                logger.info(f"✓ FRED cache populated: {fred_result.get('successful')}/{fred_result.get('total')} series")
            else:
                logger.warning(f"⚠ FRED fetch incomplete: {fred_result}")
        except Exception as e:
            logger.error(f"✗ Failed to fetch FRED data: {e}")
        
        # Fetch crypto dominance data  
        logger.info("Fetching crypto dominance data...")
        try:
            crypto_task = update_crypto_metrics.apply_async()
            crypto_result = crypto_task.get(timeout=60)
            
            if crypto_result.get('status') == 'success':
                btc = crypto_result.get('btc_dominance', 0)
                eth = crypto_result.get('eth_dominance', 0)
                logger.info(f"✓ Crypto cache populated: BTC {btc:.2f}%, ETH {eth:.2f}%")
            else:
                logger.warning(f"⚠ Crypto fetch failed: {crypto_result.get('error', 'Unknown error')}")
        except Exception as e:
            logger.error(f"✗ Failed to fetch crypto data: {e}")
        
        logger.info("=" * 60)
        logger.info("Cache initialization complete")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Cache initialization failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    initialize_cache()
