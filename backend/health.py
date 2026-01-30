"""
Health check service for startup validation and health endpoints.

This module provides centralized health check functionality used by both:
1. Application startup validation (fail-fast on critical errors)
2. Runtime health endpoints (/health/detailed)

By consolidating health checks here, we eliminate code duplication and
improve testability.
"""

import logging
from dataclasses import dataclass
from typing import Any

import redis
from sqlalchemy import create_engine, inspect, text

from . import config

logger = logging.getLogger(__name__)


@dataclass
class HealthCheckResult:
    """Result of a health check operation."""
    status: str  # "ok", "warning", "error"
    message: str
    details: dict[str, Any] | None = None


class HealthCheckService:
    """
    Centralized health check service for validating critical application dependencies.
    
    Provides both synchronous health checks for startup validation and
    structured results for health endpoints.
    """

    def __init__(self):
        """Initialize the health check service."""
        self.required_tables = [
            'fred_series_data',
            'fred_series_metadata',
            'crypto_data',
            'crypto_metadata'
        ]

    def check_env_config(self) -> dict[str, HealthCheckResult]:
        """
        Validate environment configuration.
        
        Returns:
            Dictionary mapping config keys to HealthCheckResult objects.
        """
        results = {}

        # Critical configuration
        if not config.DATABASE_URL:
            results["DATABASE_URL"] = HealthCheckResult(
                status="error",
                message="DATABASE_URL not set"
            )
        else:
            results["DATABASE_URL"] = HealthCheckResult(
                status="ok",
                message="DATABASE_URL configured"
            )

        if not config.REDIS_URL:
            results["REDIS_URL"] = HealthCheckResult(
                status="error",
                message="REDIS_URL not set"
            )
        else:
            results["REDIS_URL"] = HealthCheckResult(
                status="ok",
                message="REDIS_URL configured"
            )

        # Optional configuration (warnings only)
        if not config.FRED_API_KEY:
            results["FRED_API_KEY"] = HealthCheckResult(
                status="warning",
                message="FRED_API_KEY not set - macro data features will be limited"
            )
        else:
            results["FRED_API_KEY"] = HealthCheckResult(
                status="ok",
                message="FRED_API_KEY configured"
            )

        if not config.COINGECKO_API_KEY:
            results["COINGECKO_API_KEY"] = HealthCheckResult(
                status="warning",
                message="COINGECKO_API_KEY not set - crypto data features will be limited"
            )
        else:
            results["COINGECKO_API_KEY"] = HealthCheckResult(
                status="ok",
                message="COINGECKO_API_KEY configured"
            )

        return results

    def check_database(self) -> HealthCheckResult:
        """
        Check database connectivity and retrieve version information.
        
        Returns:
            HealthCheckResult with database status and version details.
        """
        try:
            engine = create_engine(config.DATABASE_URL)
            with engine.connect() as conn:
                result = conn.execute(text("SELECT version()"))
                version = result.scalar()
                version_short = version.split(',')[0] if version else "unknown"

                return HealthCheckResult(
                    status="ok",
                    message="Database connection OK",
                    details={"version": version_short}
                )
        except Exception as e:
            return HealthCheckResult(
                status="error",
                message=f"Database connection failed: {e}",
                details={"error": str(e)}
            )

    def check_redis(self) -> HealthCheckResult:
        """
        Check Redis connectivity and retrieve server information.
        
        Returns:
            HealthCheckResult with Redis status and server details.
        """
        try:
            redis_client = redis.from_url(config.REDIS_URL, decode_responses=True)
            redis_client.ping()
            info = redis_client.info()

            return HealthCheckResult(
                status="ok",
                message="Redis connection OK",
                details={
                    "version": info.get('redis_version', 'unknown'),
                    "used_memory": info.get('used_memory_human', 'unknown')
                }
            )
        except Exception as e:
            return HealthCheckResult(
                status="error",
                message=f"Redis connection failed: {e}",
                details={"error": str(e)}
            )

    def check_tables(self) -> HealthCheckResult:
        """
        Verify that all required database tables exist and check record counts.
        
        Returns:
            HealthCheckResult with table validation status and counts.
        """
        try:
            engine = create_engine(config.DATABASE_URL)
            inspector = inspect(engine)
            tables = inspector.get_table_names()

            missing_tables = [t for t in self.required_tables if t not in tables]

            if missing_tables:
                return HealthCheckResult(
                    status="error",
                    message=f"Missing database tables: {', '.join(missing_tables)}",
                    details={
                        "missing_tables": missing_tables,
                        "help": "Run 'python scripts/init_db.py' or 'python scripts/migrate.py upgrade'"
                    }
                )

            # Count records in critical tables
            record_counts = {}
            with engine.connect() as conn:
                fred_count = conn.execute(text("SELECT COUNT(*) FROM fred_series_data")).scalar()
                crypto_count = conn.execute(text("SELECT COUNT(*) FROM crypto_data")).scalar()
                record_counts["fred_series_data"] = fred_count
                record_counts["crypto_data"] = crypto_count

            # Determine status based on data availability
            warnings = []
            if fred_count == 0:
                warnings.append("No FRED data found - run 'python scripts/init_db.py' to populate")
            if crypto_count == 0:
                warnings.append("No crypto data found - run 'python scripts/init_crypto_data.py' to populate")

            status = "warning" if warnings else "ok"
            message = f"All {len(self.required_tables)} required tables exist"

            return HealthCheckResult(
                status=status,
                message=message,
                details={
                    "record_counts": record_counts,
                    "warnings": warnings if warnings else None
                }
            )
        except Exception as e:
            return HealthCheckResult(
                status="error",
                message=f"Table validation failed: {e}",
                details={"error": str(e)}
            )

    def run_all_checks(self) -> dict[str, Any]:
        """
        Run all health checks and return structured results.
        
        This method is designed for health endpoints that need a complete
        status overview.
        
        Returns:
            Dictionary with overall status and individual check results.
        """
        results = {
            "status": "healthy",
            "services": {}
        }

        # Check database
        db_result = self.check_database()
        results["services"]["database"] = {
            "status": db_result.status,
            "message": db_result.message
        }
        if db_result.details:
            results["services"]["database"].update(db_result.details)
        if db_result.status == "error":
            results["status"] = "degraded"

        # Check Redis
        redis_result = self.check_redis()
        results["services"]["redis"] = {
            "status": redis_result.status,
            "message": redis_result.message
        }
        if redis_result.details:
            results["services"]["redis"].update(redis_result.details)
        if redis_result.status == "error":
            results["status"] = "degraded"

        # Check tables
        tables_result = self.check_tables()
        results["services"]["tables"] = {
            "status": tables_result.status,
            "message": tables_result.message
        }
        if tables_result.details:
            results["services"]["tables"].update(tables_result.details)
        if tables_result.status == "error":
            results["status"] = "degraded"

        return results

    def log_startup_checks(self) -> bool:
        """
        Run all health checks and log results for startup validation.
        
        This method is designed for startup event, providing detailed logging
        and returning a boolean indicating if all critical checks passed.
        
        Returns:
            True if all critical checks passed, False otherwise.
        """
        logger.info("=" * 60)
        logger.info("Starting Cycle Navigator Dashboard")
        logger.info("=" * 60)
        logger.info("Running startup validation...")
        logger.info("")

        validation_passed = True

        # 1. Check environment configuration
        logger.info("1. Checking environment configuration...")
        env_results = self.check_env_config()

        for key, result in env_results.items():
            if result.status == "ok":
                logger.info(f"✓ {result.message}")
            elif result.status == "warning":
                logger.warning(f"⚠ {result.message}")
            elif result.status == "error":
                logger.error(f"✗ {result.message}")
                validation_passed = False

        logger.info("")

        # 2. Check database connectivity
        logger.info("2. Checking database connection...")
        db_result = self.check_database()

        if db_result.status == "ok":
            logger.info(f"✓ {db_result.message}")
            if db_result.details and "version" in db_result.details:
                logger.info(f"  PostgreSQL version: {db_result.details['version']}")
        else:
            logger.error(f"✗ {db_result.message}")
            logger.error("  Application cannot function without database")
            validation_passed = False

        logger.info("")

        # 3. Check Redis connectivity
        logger.info("3. Checking Redis cache connection...")
        redis_result = self.check_redis()

        if redis_result.status == "ok":
            logger.info(f"✓ {redis_result.message}")
            if redis_result.details:
                if "version" in redis_result.details:
                    logger.info(f"  Redis version: {redis_result.details['version']}")
                if "used_memory" in redis_result.details:
                    logger.info(f"  Used memory: {redis_result.details['used_memory']}")
        else:
            logger.error(f"✗ {redis_result.message}")
            logger.error("  Application performance will be severely degraded without cache")
            validation_passed = False

        logger.info("")

        # 4. Check database schema
        logger.info("4. Checking database schema...")
        tables_result = self.check_tables()

        if tables_result.status == "error":
            logger.error(f"✗ {tables_result.message}")
            if tables_result.details and "help" in tables_result.details:
                logger.error(f"  {tables_result.details['help']}")
            validation_passed = False
        else:
            logger.info(f"✓ {tables_result.message}")

            if tables_result.details and "record_counts" in tables_result.details:
                counts = tables_result.details["record_counts"]
                logger.info(f"  FRED data points: {counts.get('fred_series_data', 0):,}")
                logger.info(f"  Crypto data points: {counts.get('crypto_data', 0):,}")

            if tables_result.details and "warnings" in tables_result.details:
                for warning in tables_result.details["warnings"] or []:
                    logger.warning(f"⚠ {warning}")

        logger.info("")
        logger.info("=" * 60)

        if validation_passed:
            logger.info("✅ Startup validation PASSED - Application is ready")
        else:
            logger.error("❌ Startup validation FAILED - Application may not function correctly")
            logger.error("Please fix configuration issues before proceeding")

        logger.info("=" * 60)
        logger.info("")

        return validation_passed


# Create singleton instance for easy import
health_service = HealthCheckService()
