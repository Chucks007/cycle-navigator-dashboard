"""
Cache initialization script.

Runs on application startup to populate Redis cache with initial data.
This ensures the dashboard has data ready when users first access it.

Uses synchronous fetch functions instead of Celery tasks to avoid
the anti-pattern of calling .get() on tasks, which blocks workers
and can timeout if Celery isn't ready.
"""

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_cache():
    """
    Populate Redis cache with FRED and crypto data on startup.
    
    Uses synchronous fetch functions that don't depend on Celery workers,
    ensuring reliable initialization even during container startup.
    """
    logger.info("=" * 60)
    logger.info("Initializing application cache...")
    logger.info("=" * 60)

    try:
        # Import synchronous fetch functions (not Celery tasks)
        from backend.services.crypto import fetch_crypto_dominance_sync
        from backend.services.macro import fetch_all_fred_series_sync

        # Fetch FRED macro data synchronously
        logger.info("Fetching FRED macro series...")
        try:
            fred_result = fetch_all_fred_series_sync()

            if fred_result.get('status') == 'completed':
                successful = fred_result.get('successful', 0)
                total = fred_result.get('total', 0)
                logger.info(f"✓ FRED cache populated: {successful}/{total} series")

                # Log individual series results
                for result in fred_result.get('results', []):
                    if result.get('status') == 'success':
                        logger.info(f"  ✓ {result.get('series_id')}: {result.get('observation_count')} observations")
                    else:
                        logger.warning(f"  ✗ {result.get('series_id')}: {result.get('error', 'Unknown error')}")
            else:
                logger.warning(f"⚠ FRED fetch incomplete: {fred_result.get('error', 'Unknown error')}")
        except Exception as e:
            logger.error(f"✗ Failed to fetch FRED data: {e}")

        # Fetch crypto dominance data synchronously
        logger.info("Fetching crypto dominance data...")
        try:
            crypto_result = fetch_crypto_dominance_sync()

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
        # Don't exit with error - allow server to start anyway
        # Data can be populated later by Celery beat scheduler

if __name__ == "__main__":
    initialize_cache()
