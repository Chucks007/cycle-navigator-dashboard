# Technical Architecture

This document provides a comprehensive overview of the Cycle Navigator Dashboard's technical implementation, covering system architecture, data storage, background workers, containerization, and performance optimizations.

## Table of Contents

- [System Overview](#system-overview)
- [Database Architecture](#database-architecture)
- [Background Worker System](#background-worker-system)
- [Containerization](#containerization)
- [API Design](#api-design)
- [Caching Strategy](#caching-strategy)
- [Performance Benchmarks](#performance-benchmarks)
- [Migration & Deployment](#migration--deployment)

---

## System Overview

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                            │
│                  Next.js 15 (React Server Components)             │
│              ShadcN UI + Recharts + TanStack Query               │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                         API Layer                                 │
│                    FastAPI (Python 3.11+)                         │
│              Routers: /macro, /stocks, /crypto, /risk            │
└──────┬─────────────────────┬─────────────────────────────────────┘
       │                     │
       │ Read Cache          │ Read Persistent
       ▼                     ▼
┌──────────────┐      ┌─────────────────────┐
│    Redis     │      │  PostgreSQL 16 +    │
│   (Cache)    │◄─────┤   TimescaleDB       │
│  Sub-100ms   │Write │ (Source of Truth)   │
└──────────────┘      └──────┬──────────────┘
                             ▲
                             │ Write/Update
                             │
┌────────────────────────────┴─────────────────────────────────────┐
│                    Background Worker Layer                        │
│                    Celery + Redis Broker                          │
│   Tasks: FRED API, CoinGecko API, Analytics Processing          │
│   Schedule: Daily updates (2:00 AM UTC - FRED, 2:15 AM - Crypto) │
└──────────────────────────────────────────────────────────────────┘
```

### Core Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15, TypeScript, React 19 | Server-side rendering, client-side interactivity |
| **UI Components** | ShadcN UI, Radix UI, Tailwind CSS | Accessible, styled component library |
| **Charts** | Recharts | Interactive financial visualizations |
| **State Management** | TanStack Query, React Context | Data fetching, caching, global state |
| **Backend API** | FastAPI, Pydantic, Uvicorn | High-performance async Python API |
| **Database** | PostgreSQL 16 + TimescaleDB | Time-series data storage with hypertables |
| **Cache** | Redis 7 | Sub-100ms response times, session storage |
| **Background Workers** | Celery, Celery Beat | Scheduled data fetching, async tasks |
| **Containerization** | Podman Compose / Docker Compose | Multi-container orchestration |
| **External APIs** | FRED (Federal Reserve), CoinGecko | Macro economic data, cryptocurrency data |

---

## Database Architecture

### TimescaleDB Hypertables

The system uses **TimescaleDB** (PostgreSQL extension) for efficient time-series data storage with automatic partitioning and compression.

#### Schema: `fred_series_data`

```sql
CREATE TABLE fred_series_data (
    series_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value NUMERIC,
    PRIMARY KEY (series_id, date)
);

-- Convert to hypertable (partitioned by date)
SELECT create_hypertable('fred_series_data', 'date', 
    chunk_time_interval => INTERVAL '1 month');

-- B-Tree index for fast queries
CREATE INDEX idx_fred_series_date ON fred_series_data (series_id, date DESC);

-- Compression policy: compress data older than 90 days
ALTER TABLE fred_series_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'series_id'
);

SELECT add_compression_policy('fred_series_data', INTERVAL '90 days');
```

**Key FRED Series Tracked:**
- `M2SL` - M2 Money Supply
- `CPIAUCSL` - Consumer Price Index
- `WALCL` - Federal Reserve Total Assets
- `GFDEBTN` - Federal Debt
- `DFF` - Federal Funds Rate
- `T10Y2Y` - 10-Year Treasury Constant Maturity Minus 2-Year

#### Schema: `crypto_data`

```sql
CREATE TABLE crypto_data (
    timestamp TIMESTAMPTZ NOT NULL,
    total_market_cap NUMERIC,
    btc_dominance NUMERIC,
    eth_dominance NUMERIC,
    altcoin_market_cap NUMERIC,
    PRIMARY KEY (timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('crypto_data', 'timestamp',
    chunk_time_interval => INTERVAL '7 days');

-- Compression policy: compress data older than 30 days
ALTER TABLE crypto_data SET (timescaledb.compress);
SELECT add_compression_policy('crypto_data', INTERVAL '30 days');
```

#### Continuous Aggregates

Pre-calculate monthly M2/CPI metrics for faster queries:

```sql
CREATE MATERIALIZED VIEW fred_monthly_aggregates
WITH (timescaledb.continuous) AS
SELECT
    series_id,
    time_bucket('1 month', date) AS month,
    AVG(value) AS avg_value,
    MAX(value) AS max_value,
    MIN(value) AS min_value
FROM fred_series_data
GROUP BY series_id, time_bucket('1 month', date);

-- Refresh policy: update hourly
SELECT add_continuous_aggregate_policy('fred_monthly_aggregates',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
```

### Metadata Tables

**`fred_series_metadata`** - Tracks data freshness and fetch status:

```sql
CREATE TABLE fred_series_metadata (
    series_id VARCHAR(50) PRIMARY KEY,
    last_fetched TIMESTAMPTZ,
    fetch_status VARCHAR(20),
    error_message TEXT
);
```

### Migration Process

**Files:**
- [scripts/timescale_migrations.sql](../scripts/timescale_migrations.sql)
- [scripts/run_timescale_migrations.py](../scripts/run_timescale_migrations.py)

**Steps:**

```bash
# 1. CRITICAL: Back up production database
pg_dump -h localhost -U cycle_user cycle_navigator > backup_$(date +%Y%m%d).sql

# 2. Check prerequisites (TimescaleDB installed, version compatibility)
python scripts/run_timescale_migrations.py --check-only

# 3. Preview SQL without executing
python scripts/run_timescale_migrations.py --dry-run

# 4. Run migration (one-way operation - schedule maintenance window)
python scripts/run_timescale_migrations.py
```

**Note:** Converting to hypertables is **irreversible**. Rollback requires restoring from backup.

---

## Background Worker System

### Celery Architecture

**Components:**
- **Celery App**: Configured in [backend/celery_app.py](../backend/celery_app.py)
- **Redis Broker**: Message queue for task distribution
- **Worker Process**: Executes background tasks
- **Beat Scheduler**: Triggers periodic tasks (cron-like)

### Task Modules

**File Structure:**
```
backend/tasks/
├── __init__.py
├── common.py           # Shared utilities (retry logic, locks)
├── fred_tasks.py       # FRED API data fetching
├── crypto_tasks.py     # CoinGecko API data fetching
└── analytics_tasks.py  # Future: ML predictions, correlation analysis
```

### FRED Tasks (`fred_tasks.py`)

**Primary Task:**

```python
@celery_app.task(bind=True, max_retries=3)
def fetch_fred_series(self, series_id: str, days_back: int = 365):
    """Fetch single FRED series with retry logic."""
    try:
        # Acquire global lock to prevent concurrent API calls
        with redis_lock(f"fred:fetch:{series_id}", timeout=300):
            data = fred_api_client.get_series(series_id)
            store_to_postgres(series_id, data)
            update_redis_cache(series_id, data)
    except RateLimitError as exc:
        # Exponential backoff: 2^retry seconds
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

**Scheduled Task:**

```python
@celery_app.task
def update_all_fred_series():
    """Daily refresh of all macro indicators. Runs at 2:00 AM UTC."""
    series_list = ["M2SL", "CPIAUCSL", "WALCL", "GFDEBTN", "DFF", "T10Y2Y"]
    
    for series_id in series_list:
        fetch_fred_series.delay(series_id)  # Async execution
```

**Schedule Configuration:**

```python
# In celery_app.py
celery_app.conf.beat_schedule = {
    'update-fred-daily': {
        'task': 'backend.tasks.fred_tasks.update_all_fred_series',
        'schedule': crontab(hour=2, minute=0),  # 2:00 AM UTC
    },
}
```

### CoinGecko Tasks (`crypto_tasks.py`)

**Primary Task:**

```python
@celery_app.task(bind=True, max_retries=3)
def fetch_crypto_metrics(self):
    """Fetch crypto market cap and dominance data."""
    try:
        global_data = coingecko_api.get_global()
        
        # Calculate altcoin market cap
        total_mcap = global_data['total_market_cap']['usd']
        btc_dominance = global_data['market_cap_percentage']['btc']
        eth_dominance = global_data['market_cap_percentage']['eth']
        altcoin_mcap = total_mcap * (100 - btc_dominance - eth_dominance) / 100
        
        store_crypto_data(total_mcap, btc_dominance, eth_dominance, altcoin_mcap)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

**Schedule:**

```python
'update-crypto-daily': {
    'task': 'backend.tasks.crypto_tasks.fetch_crypto_metrics',
    'schedule': crontab(hour=2, minute=15),  # 2:15 AM UTC (after FRED)
},
```

### Rate Limiting Strategy

**FRED API Limits:**
- **Daily Limit**: 1,000 requests per API key
- **Safe Threshold**: 800 requests (80% to account for manual queries)
- **Retry Backoff**: Exponential with base 2 (2s, 4s, 8s)
- **Global Lock**: Prevents concurrent requests from multiple workers

**CoinGecko API Limits:**
- **Demo Key**: 30 calls per minute
- **Max History**: 365 days (demo tier restriction)
- **Retry Logic**: Same exponential backoff pattern

### Error Handling & Monitoring

**Logs:**

```bash
# View worker logs
podman-compose logs -f celery-worker

# View scheduler logs
podman-compose logs -f celery-beat

# Check task results
podman-compose exec redis redis-cli
> KEYS celery:*
```

**Database Health Check:**

```sql
-- Check last fetch times
SELECT series_id, last_fetched, fetch_status 
FROM fred_series_metadata 
WHERE last_fetched < NOW() - INTERVAL '26 hours';
```

---

## Containerization

### Multi-Stage Docker Build

**File:** [docker/backend.Dockerfile](../docker/backend.Dockerfile)

**Build Stages:**

1. **Builder Stage** - Install Python dependencies
2. **Data Prep Stage** - Download NLTK/TextBlob datasets
3. **Runtime Stage** - Minimal production image

**Dockerfile Structure:**

```dockerfile
# Stage 1: Build dependencies
FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Download NLP data
FROM python:3.11-slim AS data-prep
RUN python -m nltk.downloader punkt vader_lexicon
RUN python -m textblob.download_corpora

# Stage 3: Runtime
FROM python:3.11-slim AS runtime
# Create non-root user
RUN useradd -m -u 1000 appuser
WORKDIR /app

# Copy only compiled dependencies (not build tools)
COPY --from=builder /root/.local /home/appuser/.local
COPY --from=data-prep /root/nltk_data /home/appuser/nltk_data
COPY --chown=appuser:appuser ./backend /app/backend

USER appuser
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Image Size Reduction:**
- **Before**: ~1.0 GB (single-stage with build tools)
- **After**: ~200 MB (multi-stage without gcc, make, headers)

### Container Health Checks

**docker-compose.yml Configuration:**

```yaml
services:
  postgres:
    image: timescale/timescaledb-ha:pg16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  celery-worker:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    command: celery -A backend.celery_app worker --loglevel=info
    depends_on:
      backend:
        condition: service_healthy  # Wait for backend health
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    depends_on:
      - backend
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

### Service Dependency Graph

```
postgres (healthy) ──┐
                     ├──> backend (healthy) ──> celery-worker
redis (healthy) ─────┘                     └──> web
```

**Key Points:**
- PostgreSQL and Redis must be healthy before backend starts
- Backend must be healthy before workers start (ensures API is ready)
- `start_period` allows warmup time before health checks fail
- Resource limits prevent single service from consuming all host resources

---

## API Design

### Macro Summary Endpoint

**Purpose:** Reduce frontend API calls from 4+ to 1 for macro dashboard.

**Endpoint:**

```
GET /api/macro/summary?days=365
```

**Response Schema:**

```typescript
interface MacroSummaryResponse {
  liquidity: {
    data: Array<{ date: string; value: number; growth_rate: number }>;
    metadata: { last_updated: string; is_stale: boolean };
  };
  debt_status: {
    data: Array<{ date: string; value: number }>;
    metadata: { last_updated: string; is_stale: boolean };
  };
  real_rates: {
    data: Array<{ date: string; value: number }>;
    metadata: { last_updated: string; is_stale: boolean };
  };
  cpi: {
    data: Array<{ date: string; value: number }>;
    metadata: { last_updated: string; is_stale: boolean };
  };
  summary_metrics: {
    total_liquidity: number;
    debt_to_liquidity_ratio: number;
    current_real_rate: number;
  };
}
```

**Implementation:** [backend/routers/macro.py](../backend/routers/macro.py)

### Metadata Pattern

All API responses include metadata for cache management:

```json
{
  "data": [...],
  "metadata": {
    "last_updated": "2026-01-21T02:00:00Z",
    "is_stale": false
  }
}
```

**Staleness Logic:**

```python
def is_data_stale(last_updated: datetime) -> bool:
    """Mark data stale if older than 25 hours."""
    threshold = datetime.utcnow() - timedelta(hours=25)
    return last_updated < threshold
```

---

## Caching Strategy

### Two-Tier Storage

**Fast Path (Redis):**
- TTL: 24 hours
- Response Time: <100ms
- Use Case: Real-time dashboard requests

**Persistent Path (PostgreSQL):**
- Permanent storage
- Response Time: ~200ms (without continuous aggregates), ~50ms (with)
- Use Case: Cache misses, historical analysis

### Data Flow

```
1. User Request → Check Redis
   ├─ Hit → Return cached data (sub-100ms)
   └─ Miss → Query PostgreSQL → Update Redis → Return

2. Celery Worker (Daily 2 AM UTC)
   ├─ Fetch from FRED/CoinGecko
   ├─ Store in PostgreSQL (source of truth)
   └─ Update Redis cache
```

### Cache Keys

```
Pattern: {service}:{series_id}:{params}

Examples:
- macro:M2SL:365
- macro:CPIAUCSL:730
- crypto:global:365
- stock:AAPL:365
```

---

## Performance Benchmarks

| Metric | Before Optimization | After Optimization | Improvement |
|--------|--------------------|--------------------|-------------|
| **Backend Image Size** | ~1.0 GB | ~200 MB | 80% reduction |
| **FRED Query (1 year)** | ~200ms | ~50ms | 75% faster |
| **Macro Dashboard Load** | 4 API requests | 1 API request | 75% fewer calls |
| **Database Data Size** | N/A | 90% compressed (>90 days) | Significant storage savings |
| **Startup Health Check** | Manual verification | Automatic (`service_healthy`) | Eliminates race conditions |

**Continuous Aggregate Performance:**

```sql
-- Without continuous aggregate
EXPLAIN ANALYZE SELECT AVG(value) FROM fred_series_data 
WHERE series_id = 'M2SL' AND date >= '2025-01-01';
-- Planning time: 0.5ms, Execution time: 180ms

-- With continuous aggregate
EXPLAIN ANALYZE SELECT avg_value FROM fred_monthly_aggregates 
WHERE series_id = 'M2SL' AND month >= '2025-01-01';
-- Planning time: 0.3ms, Execution time: 45ms
```

---

## Migration & Deployment

### Deployment Checklist

Before deploying to production:

- [ ] Back up production database: `pg_dump cycle_navigator > backup.sql`
- [ ] Test multi-stage Docker build locally: `podman build -f docker/backend.Dockerfile .`
- [ ] Run TimescaleDB migration on staging environment
- [ ] Verify continuous aggregates are created: `SELECT * FROM timescaledb_information.continuous_aggregates;`
- [ ] Test compression policies: `SELECT * FROM timescaledb_information.compression_settings;`
- [ ] Update Celery module paths in CI/CD scripts (old: `backend.services.macro_worker` → new: `backend.celery_app`)
- [ ] Verify all service health checks pass: `podman-compose ps`
- [ ] Schedule maintenance window for production deployment
- [ ] Monitor query latency after deployment

### Breaking Changes

**1. Celery Module Path Change**

- **Old Path:** `backend.services.macro_worker`
- **New Path:** `backend.celery_app`
- **Compatibility:** Old path still works via shim but emits deprecation warning
- **Action Required:** Update docker-compose.yml and any CI/CD scripts

**2. TimescaleDB Hypertables**

- **Impact:** After migration, tables become hypertables (one-way conversion)
- **Most Queries:** Work unchanged
- **DDL Operations:** May differ (e.g., cannot add foreign keys to distributed hypertables)

### Rollback Plan

If critical issues occur:

1. **Celery Revert:**
   ```yaml
   # docker-compose.yml
   celery-worker:
     command: celery -A backend.services.macro_worker worker --loglevel=info
   ```

2. **Database Restore:**
   ```bash
   # Stop services
   podman-compose down
   
   # Restore from backup
   psql -U cycle_user cycle_navigator < backup.sql
   
   # Restart without TimescaleDB migrations
   podman-compose up -d
   ```

3. **Docker Image Revert:**
   ```bash
   # Use previous image tag
   podman pull ghcr.io/your-org/cycle-navigator-backend:previous-version
   ```

---

## Related Documentation

- **[Feature Guide](FEATURE_GUIDE.md)** - Detailed feature implementations (M2 purchasing power, crypto dominance)
- **[Developer Setup](DEVELOPER_SETUP.md)** - Local development environment configuration
- **[Deployment Guide](DEPLOYMENT.md)** - CI/CD pipelines, production deployment
- **[Verification Guide](VERIFICATION.md)** - Testing procedures, health checks
