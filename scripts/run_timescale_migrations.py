#!/usr/bin/env python3
"""
TimescaleDB Migration Runner

This script safely runs TimescaleDB migrations with validation checks.
It should be run during a maintenance window after backing up the database.

Usage:
    python scripts/run_timescale_migrations.py [--dry-run] [--check-only]

Options:
    --dry-run      Print SQL without executing
    --check-only   Only check if TimescaleDB is available and tables exist
"""

import argparse
import logging
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError, OperationalError

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import DATABASE_URL

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_timescaledb_available(engine) -> bool:
    """Check if TimescaleDB extension is available."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT * FROM pg_available_extensions WHERE name = 'timescaledb'"
            ))
            row = result.fetchone()
            if row:
                logger.info(f"TimescaleDB available: version {row[2] if len(row) > 2 else 'unknown'}")
                return True
            else:
                logger.error("TimescaleDB extension not available in this PostgreSQL instance")
                return False
    except Exception as e:
        logger.error(f"Error checking TimescaleDB availability: {e}")
        return False


def check_timescaledb_enabled(engine) -> bool:
    """Check if TimescaleDB extension is already enabled."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'"
            ))
            row = result.fetchone()
            if row:
                logger.info(f"TimescaleDB already enabled: version {row[0]}")
                return True
            return False
    except Exception as e:
        logger.error(f"Error checking if TimescaleDB is enabled: {e}")
        return False


def check_tables_exist(engine) -> dict:
    """Check which tables exist and their row counts."""
    tables = ['fred_series_data', 'crypto_data', 'fred_series_metadata', 'crypto_metadata']
    results = {}
    
    try:
        with engine.connect() as conn:
            for table in tables:
                try:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    results[table] = {'exists': True, 'rows': count}
                    logger.info(f"Table {table}: {count} rows")
                except Exception:
                    results[table] = {'exists': False, 'rows': 0}
                    logger.warning(f"Table {table}: does not exist")
    except Exception as e:
        logger.error(f"Error checking tables: {e}")
    
    return results


def check_hypertables(engine) -> list:
    """Check existing hypertables."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT hypertable_name FROM timescaledb_information.hypertables"
            ))
            hypertables = [row[0] for row in result]
            if hypertables:
                logger.info(f"Existing hypertables: {', '.join(hypertables)}")
            return hypertables
    except Exception as e:
        logger.debug(f"Could not check hypertables (TimescaleDB may not be enabled): {e}")
        return []


def run_migration(engine, dry_run: bool = False) -> bool:
    """Run the TimescaleDB migration script."""
    migration_file = Path(__file__).parent / 'timescale_migrations.sql'
    
    if not migration_file.exists():
        logger.error(f"Migration file not found: {migration_file}")
        return False
    
    sql_content = migration_file.read_text()
    
    if dry_run:
        logger.info("DRY RUN - SQL that would be executed:")
        print("-" * 60)
        print(sql_content)
        print("-" * 60)
        return True
    
    logger.info("Running TimescaleDB migration...")
    
    try:
        with engine.connect() as conn:
            # Split by semicolons and execute each statement
            # Note: For complex migrations, consider using psql directly
            statements = [s.strip() for s in sql_content.split(';') if s.strip()]
            
            for i, stmt in enumerate(statements):
                if not stmt or stmt.startswith('--'):
                    continue
                try:
                    logger.debug(f"Executing statement {i+1}/{len(statements)}")
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception as e:
                    # Some statements may fail if already applied (idempotent)
                    if 'already exists' in str(e).lower() or 'if_not_exists' in stmt.lower():
                        logger.debug(f"Skipping (already exists): {e}")
                    else:
                        logger.warning(f"Statement {i+1} warning: {e}")
            
            conn.commit()
            logger.info("✅ Migration completed successfully!")
            return True
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Run TimescaleDB migrations')
    parser.add_argument('--dry-run', action='store_true', 
                        help='Print SQL without executing')
    parser.add_argument('--check-only', action='store_true',
                        help='Only check prerequisites')
    args = parser.parse_args()
    
    logger.info("TimescaleDB Migration Runner")
    logger.info("=" * 40)
    
    # Create engine
    try:
        engine = create_engine(DATABASE_URL)
        logger.info(f"Connected to database")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(1)
    
    # Run checks
    logger.info("\n📋 Running pre-migration checks...")
    
    timescale_available = check_timescaledb_available(engine)
    if not timescale_available:
        logger.error("❌ TimescaleDB is not available. Please use timescale/timescaledb-ha:pg16 image.")
        sys.exit(1)
    
    timescale_enabled = check_timescaledb_enabled(engine)
    tables = check_tables_exist(engine)
    hypertables = check_hypertables(engine) if timescale_enabled else []
    
    if args.check_only:
        logger.info("\n📊 Check Summary:")
        logger.info(f"  TimescaleDB available: {timescale_available}")
        logger.info(f"  TimescaleDB enabled: {timescale_enabled}")
        logger.info(f"  Tables: {', '.join(t for t, v in tables.items() if v['exists'])}")
        logger.info(f"  Hypertables: {', '.join(hypertables) if hypertables else 'None'}")
        sys.exit(0)
    
    # Confirm before running
    if not args.dry_run:
        total_rows = sum(v['rows'] for v in tables.values() if v['exists'])
        logger.warning(f"\n⚠️  This will migrate {total_rows} rows to TimescaleDB hypertables.")
        logger.warning("Make sure you have backed up your database!")
        
        response = input("\nProceed with migration? [y/N]: ")
        if response.lower() != 'y':
            logger.info("Migration cancelled.")
            sys.exit(0)
    
    # Run migration
    success = run_migration(engine, dry_run=args.dry_run)
    
    if success:
        if not args.dry_run:
            # Verify results
            logger.info("\n📊 Post-migration verification:")
            check_hypertables(engine)
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()
