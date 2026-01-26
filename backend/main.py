import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .routers import comparison, crypto, macro, risk, sentiment, stocks

logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(stocks.router)
app.include_router(macro.router)
app.include_router(sentiment.router)
app.include_router(comparison.router)
app.include_router(risk.router)
app.include_router(crypto.router)


@app.on_event("startup")
async def startup_event():
    """
    Validate critical services and configuration on startup.
    
    Performs fail-fast validation to catch configuration issues early.
    Logs warnings for non-critical issues, errors for critical failures.
    """
    logger.info("=" * 60)
    logger.info("Starting Cycle Navigator Dashboard")
    logger.info("=" * 60)
    logger.info("Running startup validation...")
    logger.info("")
    
    validation_passed = True
    
    # 1. Validate environment variables
    logger.info("1. Checking environment configuration...")
    if not config.DATABASE_URL:
        logger.error("✗ DATABASE_URL not set")
        validation_passed = False
    else:
        logger.info(f"✓ DATABASE_URL configured")
    
    if not config.REDIS_URL:
        logger.error("✗ REDIS_URL not set")
        validation_passed = False
    else:
        logger.info(f"✓ REDIS_URL configured")
    
    # API keys are optional but warn if missing
    if not config.FRED_API_KEY:
        logger.warning("⚠ FRED_API_KEY not set - macro data features will be limited")
    else:
        logger.info("✓ FRED_API_KEY configured")
    
    if not config.COINGECKO_API_KEY:
        logger.warning("⚠ COINGECKO_API_KEY not set - crypto data features will be limited")
    else:
        logger.info("✓ COINGECKO_API_KEY configured")
    
    logger.info("")
    
    # 2. Check database connectivity
    logger.info("2. Checking database connection...")
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(config.DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.scalar()
            logger.info(f"✓ Database connection OK")
            logger.info(f"  PostgreSQL version: {version.split(',')[0]}")
    except Exception as e:
        logger.error(f"✗ Database connection failed: {e}")
        logger.error("  Application cannot function without database")
        validation_passed = False
    
    logger.info("")
    
    # 3. Check Redis connectivity
    logger.info("3. Checking Redis cache connection...")
    try:
        import redis
        redis_client = redis.from_url(config.REDIS_URL, decode_responses=True)
        redis_client.ping()
        info = redis_client.info()
        logger.info("✓ Redis connection OK")
        logger.info(f"  Redis version: {info.get('redis_version', 'unknown')}")
        logger.info(f"  Used memory: {info.get('used_memory_human', 'unknown')}")
    except Exception as e:
        logger.error(f"✗ Redis connection failed: {e}")
        logger.error("  Application performance will be severely degraded without cache")
        validation_passed = False
    
    logger.info("")
    
    # 4. Verify critical tables exist
    logger.info("4. Checking database schema...")
    try:
        from sqlalchemy import create_engine, inspect
        engine = create_engine(config.DATABASE_URL)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        required_tables = ['fred_series_data', 'fred_series_metadata', 'crypto_data', 'crypto_metadata']
        missing_tables = [t for t in required_tables if t not in tables]
        
        if missing_tables:
            logger.error(f"✗ Missing database tables: {', '.join(missing_tables)}")
            logger.error("  Run 'python scripts/init_db.py' or 'python scripts/migrate.py upgrade'")
            validation_passed = False
        else:
            logger.info(f"✓ All required tables exist ({len(required_tables)} tables)")
            
            # Count records in critical tables
            with engine.connect() as conn:
                fred_count = conn.execute(text("SELECT COUNT(*) FROM fred_series_data")).scalar()
                crypto_count = conn.execute(text("SELECT COUNT(*) FROM crypto_data")).scalar()
                logger.info(f"  FRED data points: {fred_count:,}")
                logger.info(f"  Crypto data points: {crypto_count:,}")
                
                if fred_count == 0:
                    logger.warning("⚠ No FRED data found - run 'python scripts/init_db.py' to populate")
                if crypto_count == 0:
                    logger.warning("⚠ No crypto data found - run 'python scripts/init_crypto_data.py' to populate")
    except Exception as e:
        logger.error(f"✗ Table validation failed: {e}")
        validation_passed = False
    
    logger.info("")
    logger.info("=" * 60)
    
    if validation_passed:
        logger.info("✅ Startup validation PASSED - Application is ready")
    else:
        logger.error("❌ Startup validation FAILED - Application may not function correctly")
        logger.error("Please fix configuration issues before proceeding")
    
    logger.info("=" * 60)
    logger.info("")


@app.get("/health")
def health_check():
    """Basic health check endpoint."""
    return {"status": "ok"}


@app.get("/health/detailed")
def detailed_health_check():
    """
    Detailed health check with database, Redis, and table validation.
    
    Returns status of all critical services.
    """
    health_status = {
        "status": "healthy",
        "services": {}
    }
    
    # Check database
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(config.DATABASE_URL)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        health_status["services"]["database"] = {"status": "ok", "message": "Connected"}
    except Exception as e:
        health_status["services"]["database"] = {"status": "error", "message": str(e)}
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        import redis
        redis_client = redis.from_url(config.REDIS_URL, decode_responses=True)
        redis_client.ping()
        health_status["services"]["redis"] = {"status": "ok", "message": "Connected"}
    except Exception as e:
        health_status["services"]["redis"] = {"status": "error", "message": str(e)}
        health_status["status"] = "degraded"
    
    # Check required tables
    try:
        from sqlalchemy import create_engine, inspect
        engine = create_engine(config.DATABASE_URL)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        required_tables = ['fred_series_data', 'fred_series_metadata', 'crypto_data', 'crypto_metadata']
        missing_tables = [t for t in required_tables if t not in tables]
        
        if missing_tables:
            health_status["services"]["tables"] = {
                "status": "error",
                "message": f"Missing tables: {', '.join(missing_tables)}"
            }
            health_status["status"] = "degraded"
        else:
            health_status["services"]["tables"] = {
                "status": "ok",
                "message": f"All {len(required_tables)} required tables exist"
            }
    except Exception as e:
        health_status["services"]["tables"] = {"status": "error", "message": str(e)}
        health_status["status"] = "degraded"
    
    return health_status
