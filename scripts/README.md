# Scripts Directory

This directory contains utility scripts for database initialization, data management, testing, and debugging.

## Main Scripts

### `init_db.py`

**Purpose**: Complete database and cache initialization for fresh deployments

**Usage:**
```bash
python scripts/init_db.py
```

**What it does:**
1. Creates all database tables (FRED, Crypto)
2. Fetches initial FRED economic data
3. Generates synthetic crypto data (365 days)
4. Populates Redis cache

**When to use:**
- First-time setup after cloning the repository
- After resetting the database
- When deploying to a new environment

---

### `init_crypto_data.py`

**Purpose**: Generate synthetic cryptocurrency market data for development

**Usage:**
```bash
# Generate 365 days of data (default)
python scripts/init_crypto_data.py

# Generate custom time period
python scripts/init_crypto_data.py --days 180

# Overwrite existing data
python scripts/init_crypto_data.py --force

# Help and options
python scripts/init_crypto_data.py --help
```

**What it does:**
- Generates realistic synthetic crypto market data
- Creates daily snapshots with variance and trends
- Populates PostgreSQL database
- Updates Redis cache
- Updates metadata for tracking

**When to use:**
- Development environment setup
- Testing with historical data
- Resetting crypto data without affecting FRED data

**Note:** Synthetic data is for development only. The Celery worker will fetch real data from CoinGecko in production via the `update_crypto_metrics` task.

---

### `run_timescale_migrations.py`

**Purpose**: Run TimescaleDB-specific migrations (hypertables, compression)

**Usage:**
```bash
# Check prerequisites only
python scripts/run_timescale_migrations.py --check-only

# Preview SQL (dry run)
python scripts/run_timescale_migrations.py --dry-run

# Run migrations
python scripts/run_timescale_migrations.py
```

**When to use:**
- After creating base tables
- When setting up TimescaleDB features
- Upgrading database schema

---

### `migrate_crypto_tables.py`

**Purpose**: Migrate crypto tables to new schema (one-time migration)

**Usage:**
```bash
python scripts/migrate_crypto_tables.py
```

**When to use:**
- One-time migration for existing deployments
- Not needed for fresh installations

---

## Debugging & Testing Scripts

### `debug_liquidity.py`

**Purpose**: Debug liquidity data fetching and calculations

**Usage:**
```bash
python scripts/debug_liquidity.py
```

---

### `test_fred_api.py`

**Purpose**: Test FRED API connectivity and data fetching

**Usage:**
```bash
python scripts/test_fred_api.py
```

**When to use:**
- Verifying FRED API key is valid
- Debugging FRED data issues
- Testing network connectivity to FRED API

---

### `verify_env.py`

**Purpose**: Verify environment variables and configuration

**Usage:**
```bash
python scripts/verify_env.py
```

**When to use:**
- Debugging configuration issues
- Validating deployment environment
- Checking API keys and database URLs

---

### `validate_env.py`

**Purpose**: Comprehensive startup validation for all services

**Usage:**
```bash
# Run full validation
python scripts/validate_env.py
```

**What it checks:**
- Environment variables (DATABASE_URL, REDIS_URL, API keys)
- Database connectivity and schema
- Redis cache connectivity
- API key validity (FRED, CoinGecko)
- Data population status

**When to use:**
- Before starting the application
- In CI/CD pipelines
- After deployment
- Troubleshooting startup issues
- Health check automation

**Exit codes:**
- 0: All validations passed
- 1: Critical issues found

---

### `manage_cache.py`

**Purpose**: Inspect and manage Redis cache keys

**Usage:**
```bash
# List all cache keys
python scripts/manage_cache.py list

# List only macro/crypto/lock keys
python scripts/manage_cache.py list macro

# Show Redis info and statistics
python scripts/manage_cache.py info

# Clear crypto cache
python scripts/manage_cache.py clear crypto

# Clear all cache (careful!)
python scripts/manage_cache.py clear all
```

**When to use:**
- Debugging cache issues
- Monitoring cache usage
- Clearing stale cache data
- Inspecting key patterns

---

### `migrate.py`

**Purpose**: Manage Alembic database migrations

**Usage:**
```bash
# Check migration status
python scripts/migrate.py check

# Show migration history
python scripts/migrate.py history

# Upgrade to latest migration
python scripts/migrate.py upgrade

# Create new migration
python scripts/migrate.py create "Add new column"

# Downgrade one version
python scripts/migrate.py downgrade -1

# Stamp existing database
python scripts/migrate.py stamp
```

**When to use:**
- Initial database setup
- Applying schema changes
- Rolling back changes
- Creating new migrations after model changes

**Note:** Replaces manual `Base.metadata.create_all()` calls with proper versioned migrations.

---

### `playwright/test_dashboard.py`

**Purpose**: End-to-end browser testing with Playwright

**Usage:**
```bash
cd scripts/playwright
pytest test_dashboard.py
```

**When to use:**
- Integration testing
- UI regression testing
- Before production deployments

---

## Common Workflows

### Fresh Development Setup
```bash
# 1. Start services
docker-compose up -d

# 2. Initialize database and data
python scripts/init_db.py

# 3. Verify setup
python scripts/verify_env.py
```

### Reset Crypto Data Only
```bash
# Generate fresh synthetic data
python scripts/init_crypto_data.py --force
```

### Verify FRED Data
```bash
# Test FRED API connectivity
python scripts/test_fred_api.py

# Debug liquidity calculations
python scripts/debug_liquidity.py
```

### Database Migration (TimescaleDB)
```bash
# Check prerequisites
python scripts/run_timescale_migrations.py --check-only

# Preview changes
python scripts/run_timescale_migrations.py --dry-run

# Apply migrations
python scripts/run_timescale_migrations.py
```

---

## Dependencies

Most scripts require:
- Database connection (PostgreSQL/TimescaleDB)
- Redis connection
- Environment variables configured
- Python packages from `requirements.txt`

Run scripts from the project root directory:
```bash
cd /path/to/cycle-navigator-dashboard
python scripts/<script_name>.py
```

---

## Adding New Scripts

When adding new scripts to this directory:

1. **Add shebang**: `#!/usr/bin/env python3`
2. **Add docstring**: Clear description of purpose
3. **Make executable**: `chmod +x scripts/your_script.py`
4. **Add to this README**: Document usage and purpose
5. **Add logging**: Use `logging` module for output
6. **Handle errors**: Graceful error handling with informative messages

---

## Related Documentation

- [DEVELOPER_SETUP.md](../documents/DEVELOPER_SETUP.md) - Development environment setup
- [DEPLOYMENT.md](../documents/DEPLOYMENT.md) - Production deployment procedures
- [VERIFICATION.md](../documents/VERIFICATION.md) - System verification and debugging
