#!/usr/bin/env python3
"""
Environment and service validation script.

Validates that all required services, environment variables, and data
are properly configured before running the application.

Can be run standalone or as part of deployment validation.
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)


def validate_environment_variables():
    """Validate required environment variables."""
    logger.info("\n📋 Checking Environment Variables")
    logger.info("-" * 60)
    
    from backend import config
    
    issues = []
    warnings = []
    
    # Critical variables
    if not config.DATABASE_URL:
        issues.append("DATABASE_URL not set")
    else:
        logger.info(f"✓ DATABASE_URL: {config.DATABASE_URL[:30]}...")
    
    if not config.REDIS_URL:
        issues.append("REDIS_URL not set")
    else:
        logger.info(f"✓ REDIS_URL: {config.REDIS_URL}")
    
    # Optional but recommended
    if not config.FRED_API_KEY:
        warnings.append("FRED_API_KEY not set - macro features limited")
        logger.info("⚠ FRED_API_KEY: Not set (optional)")
    else:
        logger.info(f"✓ FRED_API_KEY: {config.FRED_API_KEY[:10]}...")
    
    if not config.COINGECKO_API_KEY:
        warnings.append("COINGECKO_API_KEY not set - crypto features limited")
        logger.info("⚠ COINGECKO_API_KEY: Not set (optional)")
    else:
        logger.info(f"✓ COINGECKO_API_KEY: {config.COINGECKO_API_KEY[:10]}...")
    
    # Celery configuration
    if config.CELERY_BROKER_URL:
        logger.info(f"✓ CELERY_BROKER_URL: {config.CELERY_BROKER_URL[:30]}...")
    
    return issues, warnings


def validate_database():
    """Validate database connectivity and schema."""
    logger.info("\n🗄️  Checking Database")
    logger.info("-" * 60)
    
    from backend import config
    issues = []
    
    try:
        from sqlalchemy import create_engine, text, inspect
        
        # Test connection
        engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.scalar()
            logger.info(f"✓ Connection: OK")
            logger.info(f"  PostgreSQL: {version.split(',')[0]}")
            
        # Check tables
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        required_tables = {
            'fred_series_data': 'FRED economic data',
            'fred_series_metadata': 'FRED metadata',
            'crypto_data': 'Cryptocurrency market data',
            'crypto_metadata': 'Crypto metadata'
        }
        
        missing = []
        for table, description in required_tables.items():
            if table in tables:
                # Count records
                with engine.connect() as conn:
                    count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                    logger.info(f"✓ Table: {table} ({count:,} records)")
            else:
                logger.error(f"✗ Table: {table} - MISSING")
                missing.append(table)
        
        if missing:
            issues.append(f"Missing tables: {', '.join(missing)}")
            logger.info("\n  💡 Run: python scripts/init_db.py")
        
        # Check for Alembic version table
        if 'alembic_version' in tables:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
                if result:
                    logger.info(f"✓ Alembic: Migration version {result[0]}")
                else:
                    logger.info("⚠ Alembic: No migrations applied")
        else:
            logger.info("⚠ Alembic: Not initialized")
            logger.info("  💡 Run: python scripts/migrate.py stamp")
            
    except Exception as e:
        logger.error(f"✗ Database: {e}")
        issues.append(f"Database error: {e}")
    
    return issues


def validate_redis():
    """Validate Redis connectivity."""
    logger.info("\n💾 Checking Redis Cache")
    logger.info("-" * 60)
    
    from backend import config
    issues = []
    
    try:
        import redis
        
        client = redis.from_url(config.REDIS_URL, decode_responses=True)
        client.ping()
        
        info = client.info()
        logger.info(f"✓ Connection: OK")
        logger.info(f"  Redis: {info.get('redis_version', 'unknown')}")
        logger.info(f"  Memory: {info.get('used_memory_human', 'unknown')}")
        logger.info(f"  Keys: {client.dbsize():,}")
        
        # Check for cached data
        from backend.cache_keys import CacheKeys
        
        macro_keys = CacheKeys.list_all_keys(client, 'macro')
        crypto_keys = CacheKeys.list_all_keys(client, 'crypto')
        
        logger.info(f"  Cached macro series: {len(macro_keys)}")
        logger.info(f"  Cached crypto data: {len(crypto_keys)}")
        
        if len(macro_keys) == 0 and len(crypto_keys) == 0:
            logger.info("⚠ No cached data found")
            logger.info("  💡 Run: python scripts/init_db.py")
        
    except Exception as e:
        logger.error(f"✗ Redis: {e}")
        issues.append(f"Redis error: {e}")
    
    return issues


def validate_api_keys():
    """Validate external API keys (optional)."""
    logger.info("\n🔑 Checking API Keys")
    logger.info("-" * 60)
    
    from backend import config
    warnings = []
    
    # FRED API
    if config.FRED_API_KEY:
        try:
            from fredapi import Fred
            fred = Fred(api_key=config.FRED_API_KEY)
            # Test with a simple query
            data = fred.get_series('M2SL', observation_start='2024-01-01', observation_end='2024-01-31')
            if data is not None and len(data) > 0:
                logger.info("✓ FRED API: Valid key, API accessible")
            else:
                logger.info("⚠ FRED API: Key valid but unexpected response")
                warnings.append("FRED API returned unexpected data")
        except Exception as e:
            logger.error(f"✗ FRED API: {e}")
            warnings.append(f"FRED API error: {e}")
    else:
        logger.info("⚠ FRED API: Key not configured (optional)")
    
    # CoinGecko API
    if config.COINGECKO_API_KEY:
        try:
            import requests
            headers = {"x-cg-demo-api-key": config.COINGECKO_API_KEY}
            response = requests.get(
                "https://api.coingecko.com/api/v3/ping",
                headers=headers,
                timeout=10
            )
            if response.status_code == 200:
                logger.info("✓ CoinGecko API: Valid key, API accessible")
            else:
                logger.error(f"✗ CoinGecko API: HTTP {response.status_code}")
                warnings.append(f"CoinGecko API returned {response.status_code}")
        except Exception as e:
            logger.error(f"✗ CoinGecko API: {e}")
            warnings.append(f"CoinGecko API error: {e}")
    else:
        logger.info("⚠ CoinGecko API: Key not configured (optional)")
    
    return warnings


def main():
    """Run all validation checks."""
    logger.info("\n" + "=" * 60)
    logger.info("🔍 Cycle Navigator Dashboard - Environment Validation")
    logger.info("=" * 60)
    
    all_issues = []
    all_warnings = []
    
    # 1. Environment variables
    issues, warnings = validate_environment_variables()
    all_issues.extend(issues)
    all_warnings.extend(warnings)
    
    # 2. Database
    issues = validate_database()
    all_issues.extend(issues)
    
    # 3. Redis
    issues = validate_redis()
    all_issues.extend(issues)
    
    # 4. API Keys (optional)
    warnings = validate_api_keys()
    all_warnings.extend(warnings)
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📊 Validation Summary")
    logger.info("=" * 60)
    
    if all_issues:
        logger.error(f"\n❌ {len(all_issues)} Critical Issue(s) Found:")
        for issue in all_issues:
            logger.error(f"  • {issue}")
    
    if all_warnings:
        logger.warning(f"\n⚠️  {len(all_warnings)} Warning(s):")
        for warning in all_warnings:
            logger.warning(f"  • {warning}")
    
    if not all_issues and not all_warnings:
        logger.info("\n✅ All validations passed!")
        logger.info("Environment is properly configured.")
    elif not all_issues:
        logger.info("\n✅ Core validations passed!")
        logger.info("Application can run but some features may be limited.")
    else:
        logger.error("\n❌ Validation failed!")
        logger.error("Please fix critical issues before running the application.")
    
    logger.info("\n" + "=" * 60)
    logger.info("")
    
    # Exit with appropriate code
    sys.exit(1 if all_issues else 0)


if __name__ == "__main__":
    main()
