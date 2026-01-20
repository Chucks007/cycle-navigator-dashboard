# API Hardening - Background Worker Implementation

## Overview

This implementation moves FRED API interactions out of the request-response cycle using a background worker system with Celery. Data is fetched on a schedule, stored in PostgreSQL (source of truth), and cached in Redis for instant frontend responses.

## Architecture

```
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │ HTTP Request (sub-100ms)
       │
┌──────▼───────────────┐
│  FastAPI Backend     │
│  (reads from cache)  │
└──────┬───────────────┘
       │
       │ Read
       ▼
┌─────────────────────┐        ┌──────────────────┐
│   Redis Cache       │◄───────│  Celery Worker   │
│  (Fast responses)   │        │  (Background)    │
└─────────────────────┘        └────────┬─────────┘
                                        │
                                        │ Store
                                        ▼
                               ┌─────────────────┐
                               │   PostgreSQL    │
                               │ (Source of Truth)│
                               └─────────────────┘
                                        ▲
                                        │ Fetch (scheduled)
                                        │
                               ┌────────┴────────┐
                               │   FRED API      │
                               └─────────────────┘
```

## Components

### 1. Database Layer (PostgreSQL)

**File:** `backend/models.py`

- **FREDSeriesData**: Stores individual time series observations (date + value)
- **FREDSeriesMetadata**: Tracks last fetch time, data freshness, error status

### 2. Worker Layer (Celery)

**File:** `backend/services/macro_worker.py`

- **fetch_fred_series**: Task to fetch individual FRED series with retry logic
- **update_all_fred_series**: Scheduled task (daily at 2 AM UTC) to refresh all macro indicators
- **Rate limiting**: Global lock prevents concurrent FRED API calls
- **Exponential backoff**: Retries failed requests with increasing delays

### 3. Service Layer (Modified)

**File:** `backend/services/macro.py`

- Reads from Redis cache first (fast path)
- Falls back to PostgreSQL if cache miss
- Returns data + metadata (last_updated, is_stale)
- No direct FRED API calls during requests

### 4. API Layer (Modified)

**Files:** `backend/routers/macro.py`, `backend/schemas.py`

- New response models include metadata
- Frontend can check `metadata.is_stale` to detect old data
- Suggested polling: every 5-10 minutes

## Data Flow

### Initial Setup
1. Run `python scripts/init_db.py` to create tables and populate cache
2. Database and Redis are populated with historical FRED data

### Normal Operation
1. **User requests macro data** → API reads from Redis (sub-100ms response)
2. **Celery Beat triggers daily** → Worker fetches from FRED API
3. **Worker stores in PostgreSQL** → Updates Redis cache
4. **Frontend polls periodically** → Checks `metadata.is_stale` flag

### Error Handling
- **FRED API down**: Serve stale data from PostgreSQL with `is_stale: true`
- **Worker failure**: Retry with exponential backoff (3 attempts)
- **Rate limit hit**: Global lock prevents concurrent requests

## Configuration

**File:** `backend/config.py`

```python
# Cache settings
REDIS_CACHE_TTL = 86400  # 24 hours
DATA_STALE_THRESHOLD_HOURS = 25  # Mark stale after 25 hours
DATA_UPDATE_HOUR = 2  # Daily update at 2 AM UTC

# Rate limiting
FRED_RATE_LIMIT_DAILY = 1000  # FRED API limit
FRED_SAFE_REQUEST_LIMIT = 800  # Stay well below
FRED_RETRY_MAX_ATTEMPTS = 3
FRED_RETRY_BACKOFF_BASE = 2  # 2^retry seconds
```

## Deployment

### Docker Compose Services

1. **postgres**: PostgreSQL 16 (data persistence)
2. **redis**: Redis 7 (caching + Celery broker)
3. **backend**: FastAPI application
4. **celery-worker**: Background worker for data fetching
5. **celery-beat**: Scheduler for periodic tasks
6. **web**: Next.js frontend

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
FRED_API_KEY=your_api_key_here
POSTGRES_PASSWORD=secure_password
```

### Startup

```bash
# Start all services
docker-compose up -d

# Initialize database and populate cache (first time only)
docker-compose exec backend python scripts/init_db.py

# Check worker logs
docker-compose logs -f celery-worker
docker-compose logs -f celery-beat
```

## Monitoring

### Check Worker Status
```bash
# View Celery worker logs
docker-compose logs celery-worker

# View scheduled tasks
docker-compose logs celery-beat
```

### Check Data Freshness
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U cycle_user -d cycle_navigator

# Query metadata
SELECT series_id, last_fetched, fetch_status FROM fred_series_metadata;
```

### Check Redis Cache
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# List cached keys
KEYS macro:*

# Check specific series
GET macro:M2SL
```

## Frontend Integration

The API now returns data with metadata:

```json
{
  "data": [
    {"date": "2026-01-01", "value": 21000.5, "growth_rate": 0.03},
    ...
  ],
  "metadata": {
    "last_updated": "2026-01-20T02:00:00Z",
    "is_stale": false
  }
}
```

### Recommended Frontend Pattern

```typescript
// Poll macro endpoint every 5 minutes
useEffect(() => {
  const fetchMacro = async () => {
    const res = await fetch('/api/macro/liquidity');
    const { data, metadata } = await res.json();
    
    if (metadata.is_stale) {
      // Show warning: "Data may be outdated"
      console.warn('Macro data is stale:', metadata.last_updated);
    }
    
    setMacroData(data);
  };
  
  fetchMacro();
  const interval = setInterval(fetchMacro, 5 * 60 * 1000); // 5 min
  
  return () => clearInterval(interval);
}, []);
```

## Acceptance Criteria Status

- ✅ **Dashboard loads instantly**: Redis cache provides sub-100ms responses
- ✅ **No direct FRED API calls**: All requests read from cache/database
- ✅ **Scheduled updates**: Celery Beat runs daily at 2 AM UTC
- ✅ **Graceful degradation**: Serves stale data if FRED is down
- ✅ **Rate limit prevention**: Global lock + conservative request limits
- ✅ **Cache invalidation**: Frontend checks `is_stale` flag
- ✅ **Concurrency handling**: Redis lock prevents simultaneous refreshes

## Troubleshooting

### Worker not updating data
```bash
# Restart worker
docker-compose restart celery-worker celery-beat

# Manually trigger update
docker-compose exec backend python -c "from backend.services.macro_worker import update_all_fred_series; print(update_all_fred_series())"
```

### Database connection errors
```bash
# Check PostgreSQL health
docker-compose exec postgres pg_isready -U cycle_user

# Reinitialize database
docker-compose exec backend python scripts/init_db.py
```

### Redis connection errors
```bash
# Check Redis health
docker-compose exec redis redis-cli ping

# Clear cache and restart
docker-compose exec redis redis-cli FLUSHALL
docker-compose restart backend
```

## Future Enhancements

1. **Metrics Dashboard**: Add Prometheus/Grafana for worker monitoring
2. **Alerting**: Notify on fetch failures or stale data threshold
3. **Multi-tenancy**: Support multiple FRED API keys for higher rate limits
4. **Historical archiving**: Move old data to separate cold storage
5. **Smart refresh**: Only fetch series that have new data available
