# Developer Setup

This guide walks you through setting up a local development environment for the Cycle Navigator Dashboard. Follow these instructions to run the backend (FastAPI), frontend (Next.js), and supporting services (PostgreSQL, Redis, Celery) on your local machine.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Docker Compose)](#quick-start-docker-compose)
- [Local Development (No Containers)](#local-development-no-containers)
- [Environment Variables](#environment-variables)
- [Database Initialization](#database-initialization)
- [Running Tests](#running-tests)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows (with WSL2 recommended)
- **Python**: 3.11 or higher
- **Node.js**: 20.x or higher
- **Docker/Podman**: Latest stable version (for containerized setup)
- **PostgreSQL**: 16+ with TimescaleDB extension (for local development)
- **Redis**: 7+ (for local development)

### API Keys

You'll need free API keys from the following services:

1. **FRED (Federal Reserve Economic Data)**
   - Sign up: [https://fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)
   - Daily limit: 1,000 requests
   - Used for: M2, CPI, interest rates, federal debt data

2. **CoinGecko**
   - Sign up: [https://www.coingecko.com/en/api](https://www.coingecko.com/en/api)
   - Demo tier: 30 calls/minute, 365-day history max
   - Used for: Crypto market cap and dominance data

---

## Quick Start (Docker Compose)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/cycle-navigator-dashboard.git
cd cycle-navigator-dashboard
```

### 2. Configure Environment

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```bash
# Required API Keys
FRED_API_KEY=your_fred_api_key_here
COINGECKO_API_KEY=your_coingecko_api_key_here

# Database (auto-configured by Docker Compose)
POSTGRES_USER=cycle_user
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=cycle_navigator

# Redis (auto-configured)
REDIS_HOST=redis
REDIS_PORT=6379
```

### 3. Start All Services

**Using Docker Compose:**

```bash
docker-compose up --build -d
```

**Using Podman Compose:**

```bash
podman-compose up --build -d
```

**Services Started:**
- **postgres**: PostgreSQL 16 + TimescaleDB (port 5432)
- **redis**: Redis 7 (port 6379)
- **backend**: FastAPI server (port 8000)
- **celery-worker**: Background data fetching worker
- **celery-beat**: Task scheduler
- **web**: Next.js frontend (port 3000)

### 4. Initialize Database

Run the database initialization script to create tables and populate initial data:

```bash
# Docker Compose
docker-compose exec backend python scripts/init_db.py

# Podman Compose
podman-compose exec backend python scripts/init_db.py
```

**What this does:**
- Creates database tables (fred_series_data, crypto_data, etc.)
- Converts tables to TimescaleDB hypertables
- Creates continuous aggregates and compression policies
- Fetches initial data from FRED and CoinGecko APIs
- Populates Redis cache

### 5. Verify Services

Check that all containers are healthy:

```bash
# Docker Compose
docker-compose ps

# Podman Compose
podman-compose ps
```

All services should show status as `Up` or `healthy`.

**Access Points:**
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### 6. View Logs

**All services:**

```bash
docker-compose logs -f
```

**Specific service:**

```bash
docker-compose logs -f celery-worker
docker-compose logs -f backend
docker-compose logs -f web
```

---

## Local Development (No Containers)

### Backend Setup

#### 1. Create Python Virtual Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate (Linux/macOS)
source .venv/bin/activate

# Activate (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Activate (Windows CMD)
.venv\Scripts\activate.bat
```

#### 2. Install Dependencies

**Production dependencies:**

```bash
pip install -r requirements.txt
```

**Development dependencies** (includes testing, linting, Playwright):

```bash
pip install -r requirements-dev.txt
```

#### 3. Install PostgreSQL + TimescaleDB

**Ubuntu/Debian:**

```bash
# Add TimescaleDB repository
sudo sh -c "echo 'deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main' > /etc/apt/sources.list.d/timescaledb.list"
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo apt-key add -

# Install TimescaleDB
sudo apt update
sudo apt install timescaledb-2-postgresql-16

# Enable extension
sudo timescaledb-tune --quiet --yes
sudo systemctl restart postgresql
```

**macOS (Homebrew):**

```bash
brew install timescaledb
```

**Windows:**
- Download installer from [https://www.timescale.com/download](https://www.timescale.com/download)

#### 4. Create Database

```bash
# Connect as postgres user
sudo -u postgres psql

# Create user and database
CREATE USER cycle_user WITH PASSWORD 'secure_password';
CREATE DATABASE cycle_navigator OWNER cycle_user;

# Connect to database and enable TimescaleDB
\c cycle_navigator
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q
```

Update `.env` with local database connection:

```bash
DATABASE_URL=postgresql://cycle_user:secure_password@localhost:5432/cycle_navigator
```

#### 5. Install Redis

**Ubuntu/Debian:**

```bash
sudo apt install redis-server
sudo systemctl start redis
```

**macOS:**

```bash
brew install redis
brew services start redis
```

**Windows:**
- Download from [https://redis.io/download](https://redis.io/download) or use WSL2

Update `.env`:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### 6. Run Backend Server

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Flags:**
- `--reload`: Auto-restart on file changes (development only)
- `--host 0.0.0.0`: Accept connections from any IP
- `--port 8000`: Bind to port 8000

#### 7. Run Celery Worker

**Terminal 2:**

```bash
celery -A backend.celery_app worker --loglevel=info
```

**Terminal 3 (Optional - Scheduler):**

```bash
celery -A backend.celery_app beat --loglevel=info
```

**Note:** For development, you may skip Celery Beat and manually trigger tasks.

### Frontend Setup

#### 1. Install Node.js Dependencies

```bash
cd web
npm install
```

#### 2. Configure Frontend Environment

Create `web/.env.local`:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Important:** For production builds, this must be set at **build time**, not runtime. See [Technical Architecture](TECHNICAL_ARCHITECTURE.md) for details.

#### 3. Run Development Server

```bash
npm run dev
```

**Access:** [http://localhost:3000](http://localhost:3000)

**Hot Reload:** Changes to React components auto-refresh in browser.

#### 4. Build for Production

```bash
npm run build
npm start
```

---

## Environment Variables

### Complete `.env` Template

```bash
# ============================================
# API Keys (Required)
# ============================================
FRED_API_KEY=your_fred_api_key_here
COINGECKO_API_KEY=your_coingecko_api_key_here

# ============================================
# Database Configuration
# ============================================
POSTGRES_USER=cycle_user
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=cycle_navigator
POSTGRES_HOST=localhost  # Use 'postgres' in Docker Compose
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}

# ============================================
# Redis Configuration
# ============================================
REDIS_HOST=localhost  # Use 'redis' in Docker Compose
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_TTL=86400  # 24 hours

# ============================================
# Celery Configuration
# ============================================
CELERY_BROKER_URL=redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}
CELERY_RESULT_BACKEND=redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}

# ============================================
# Application Settings
# ============================================
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR
DATA_STALE_THRESHOLD_HOURS=25
DATA_UPDATE_HOUR=2  # UTC hour for scheduled updates

# ============================================
# Rate Limiting
# ============================================
FRED_RATE_LIMIT_DAILY=1000
FRED_SAFE_REQUEST_LIMIT=800
FRED_RETRY_MAX_ATTEMPTS=3
COINGECKO_RATE_LIMIT_PER_MINUTE=30

# ============================================
# Frontend (Build-Time Only)
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Database Initialization

### Option 1: Automated Init Script (Recommended)

```bash
python scripts/init_db.py
```

**This script:**
1. Runs Alembic migrations to create/update database tables
2. Runs TimescaleDB migrations (hypertables, continuous aggregates, compression)
3. Fetches initial FRED data (M2, CPI, federal debt, interest rates)
4. Generates synthetic crypto data (365 days for development)
5. Populates Redis cache

**Verify setup after initialization:**

```bash
# Run comprehensive validation
python scripts/validate_env.py
```

This checks database connectivity, Redis cache, API keys, and data population.

### Option 1a: Crypto Data Only (Re-initialization)

If you need to reset or regenerate crypto data separately:

```bash
# Generate 365 days of synthetic data (default)
python scripts/init_crypto_data.py

# Generate different time period
python scripts/init_crypto_data.py --days 180

# Force overwrite existing data
python scripts/init_crypto_data.py --force
```

**Note:** Synthetic data is used for development. The Celery worker will fetch real data from CoinGecko via the `update_crypto_metrics` task, which runs daily.

### Option 2: Manual Migration with Alembic

```bash
# Check migration status
python scripts/migrate.py check

# Show migration history
python scripts/migrate.py history

# Upgrade to latest migration
python scripts/migrate.py upgrade

# Or use Alembic directly
alembic upgrade head
```

**For existing databases:**
If you have an existing database with tables already created, stamp it with the current migration:

```bash
# Mark database as up-to-date without running migrations
python scripts/migrate.py stamp
```

### Option 3: Legacy Manual Method

```bash
# Check prerequisites
python scripts/run_timescale_migrations.py --check-only

# Preview SQL
python scripts/run_timescale_migrations.py --dry-run

# Run migration
python scripts/run_timescale_migrations.py
```

**Manual data fetch:**

```bash
python -c "
from backend.tasks.fred_tasks import update_all_fred_series
from backend.tasks.crypto_tasks import update_crypto_metrics
update_all_fred_series()
update_crypto_metrics()
"
```

---

## Running Tests

### Backend Tests

**Run all tests:**

```bash
pytest
```

**Run specific test file:**

```bash
pytest tests/test_macro_service.py
```

**Run with coverage:**

```bash
pytest --cov=backend --cov-report=html
```

**View coverage report:**

```bash
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

### Frontend Tests

**Unit tests:**

```bash
cd web
npm test
```

**Specific test file:**

```bash
npm test series-utils
```

**E2E tests (Playwright):**

```bash
# Install Playwright browsers (first time only)
python -m playwright install chromium

# Run E2E tests
python scripts/playwright/test_dashboard.py
```

**Headless mode:**

```bash
PLAYWRIGHT_HEADLESS=true python scripts/playwright/test_dashboard.py
```

### Linting

**Python (Ruff):**

```bash
ruff check backend/
ruff format backend/
```

**TypeScript (ESLint):**

```bash
cd web
npm run lint
```

---

## Troubleshooting

### Backend Issues

#### Database Connection Errors

**Error:** `psycopg2.OperationalError: could not connect to server`

**Solution:**

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list  # macOS

# Verify connection string in .env
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

#### Redis Connection Errors

**Error:** `redis.exceptions.ConnectionError: Error connecting to Redis`

**Solution:**

```bash
# Check Redis is running
redis-cli ping  # Should return PONG

# Check Redis port
netstat -tuln | grep 6379

# Restart Redis
sudo systemctl restart redis  # Linux
brew services restart redis  # macOS
```

#### Celery Worker Not Running

**Error:** Tasks not executing in background

**Solution:**

```bash
# Check worker is running
celery -A backend.celery_app inspect active

# Restart worker
pkill -f "celery worker"
celery -A backend.celery_app worker --loglevel=info
```

#### FRED API Key Invalid

**Error:** `401 Unauthorized` from FRED API

**Solution:**

```bash
# Verify API key is set
echo $FRED_API_KEY

# Test API key
python scripts/test_fred_api.py

# Get new key: https://fred.stlouisfed.org/docs/api/api_key.html
```

### Frontend Issues

#### API URL Not Set

**Error:** Frontend can't connect to backend

**Solution:**

```bash
# Check NEXT_PUBLIC_API_URL is set
cd web
cat .env.local

# For development
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Rebuild
npm run build
```

#### Chart Not Rendering

**Error:** Charts show loading state indefinitely

**Solution:**

```bash
# Check browser console for errors (F12)
# Verify API endpoint returns data
curl http://localhost:8000/api/macro/liquidity?days=365

# Clear cache and rebuild
cd web
rm -rf .next/
npm run build
npm run dev
```

#### Dependency Installation Fails

**Error:** `npm install` fails with peer dependency conflicts

**Solution:**

```bash
# Use legacy peer deps flag
npm install --legacy-peer-deps

# Or clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Docker Compose Issues

#### Container Health Check Failing

**Error:** Container shows `unhealthy` status

**Solution:**

```bash
# Check logs
docker-compose logs backend

# Inspect health check
docker inspect cycle-navigator-backend | grep -A 20 Health

# Manually test health endpoint
curl http://localhost:8000/health
```

#### Port Already in Use

**Error:** `bind: address already in use`

**Solution:**

```bash
# Find process using port
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process or change port in docker-compose.yml
```

#### TimescaleDB Extension Not Found

**Error:** `ERROR: could not open extension control file`

**Solution:**

```bash
# Ensure TimescaleDB image is used
# In docker-compose.yml:
# image: timescale/timescaledb-ha:pg16

# Rebuild containers
docker-compose down
docker-compose up --build -d
```

### Common Development Pitfalls

#### Stale Cache Data

**Issue:** Frontend shows old data after backend changes

**Solution:**

```bash
# Flush Redis cache
docker-compose exec redis redis-cli FLUSHALL

# Or manually in Python
python -c "import redis; r = redis.Redis(host='localhost'); r.flushall()"
```

#### Migration Already Applied

**Issue:** Re-running migration script fails

**Solution:**

```bash
# Migrations are idempotent, but if tables already exist:
# Option 1: Drop and recreate (loses data)
psql $DATABASE_URL -c "DROP TABLE fred_series_data CASCADE;"

# Option 2: Skip migration, just populate data
python scripts/init_db.py --skip-migrations
```

#### Celery Task Not Found

**Issue:** `celery.exceptions.NotRegistered: 'backend.tasks.fred_tasks.update_all_fred_series'`

**Solution:**

```bash
# Ensure Celery app imports tasks
# Check backend/celery_app.py includes:
from backend.tasks import fred_tasks, crypto_tasks

# Restart worker
celery -A backend.celery_app worker --loglevel=info
```

---

## Useful Commands

### Database Management

```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Check hypertable status
SELECT * FROM timescaledb_information.hypertables;

# Check continuous aggregates
SELECT * FROM timescaledb_information.continuous_aggregates;

# Check compression status
SELECT * FROM timescaledb_information.chunks;

# Query data
SELECT * FROM fred_series_data WHERE series_id = 'M2SL' ORDER BY date DESC LIMIT 10;
```

### Redis Management

```bash
# Connect to Redis
redis-cli

# List all keys
KEYS *

# Check specific cache
GET macro:M2SL:365

# Clear all cache
FLUSHALL

# Monitor real-time commands
MONITOR
```

### Celery Management

```bash
# List registered tasks
celery -A backend.celery_app inspect registered

# List active tasks
celery -A backend.celery_app inspect active

# Manually trigger task
celery -A backend.celery_app call backend.tasks.fred_tasks.update_all_fred_series

# View scheduled tasks
celery -A backend.celery_app inspect scheduled
```

---

## Related Documentation

- **[Technical Architecture](TECHNICAL_ARCHITECTURE.md)** - System design, database schema, worker architecture
- **[Feature Guide](FEATURE_GUIDE.md)** - M2 purchasing power, crypto dominance features
- **[Deployment Guide](DEPLOYMENT.md)** - CI/CD pipelines, production deployment
- **[Verification Guide](VERIFICATION.md)** - Testing procedures, health checks

---

## Getting Help

- **GitHub Issues**: [https://github.com/your-org/cycle-navigator-dashboard/issues](https://github.com/your-org/cycle-navigator-dashboard/issues)
- **Documentation**: Check other docs in [documents/](../documents/) folder
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs) (when backend is running)
