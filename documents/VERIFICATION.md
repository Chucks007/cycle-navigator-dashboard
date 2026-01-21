# Verification Guide

This document provides comprehensive testing and verification procedures for the Cycle Navigator Dashboard. Use these checks to ensure system health, validate deployments, and troubleshoot issues.

## Table of Contents

- [Container Health Verification](#container-health-verification)
- [API Connectivity Tests](#api-connectivity-tests)
- [Frontend Chart Rendering](#frontend-chart-rendering)
- [Database Verification](#database-verification)
- [End-to-End Testing (Playwright)](#end-to-end-testing-playwright)
- [Performance Validation](#performance-validation)
- [Troubleshooting Matrix](#troubleshooting-matrix)

---

## Container Health Verification

### Check All Container Status

**Docker Compose:**

```bash
docker-compose ps
```

**Podman Compose:**

```bash
podman-compose ps
```

**Expected Output:**

| Container | Status | Health | Ports |
|-----------|--------|--------|-------|
| postgres | Up | healthy | 5432:5432 |
| redis | Up | healthy | 6379:6379 |
| backend | Up | healthy | 8000:8000 |
| celery-worker | Up | healthy | - |
| celery-beat | Up | - | - |
| web | Up | healthy | 3000:3000 |

### Individual Health Checks

#### PostgreSQL

```bash
# Docker
docker-compose exec postgres pg_isready -U cycle_user

# Podman
podman exec cycle-navigator-postgres pg_isready -U cycle_user
```

**Expected:** `cycle_user:5432 - accepting connections`

#### Redis

```bash
# Docker
docker-compose exec redis redis-cli ping

# Podman
podman exec cycle-navigator-redis redis-cli ping
```

**Expected:** `PONG`

#### Backend (FastAPI)

```bash
curl -s http://localhost:8000/health | jq
```

**Expected:**

```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "version": "1.0.0"
}
```

#### Celery Worker

```bash
# Docker
docker-compose exec backend celery -A backend.celery_app inspect ping

# Podman
podman exec cycle-navigator-backend celery -A backend.celery_app inspect ping
```

**Expected:**

```json
{
  "celery@<hostname>": {
    "ok": "pong"
  }
}
```

#### Frontend (Next.js)

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
```

**Expected:** `HTTP 200`

---

## API Connectivity Tests

### Backend API Endpoints

#### 1. Macro Liquidity (M2 Money Supply)

```bash
curl -s "http://localhost:8000/api/macro/liquidity?days=365" | jq '.data | length'
```

**Expected:** Number of data points (e.g., `365` for daily data)

**Check metadata:**

```bash
curl -s "http://localhost:8000/api/macro/liquidity?days=30" | jq '.metadata'
```

**Expected:**

```json
{
  "last_updated": "2026-01-21T02:00:00Z",
  "is_stale": false
}
```

#### 2. Crypto Dominance

```bash
curl -s "http://localhost:8000/api/crypto/dominance?days=365" | jq '.data | length'
```

**Expected:** Number of data points

**Check altcoin calculation:**

```bash
curl -s "http://localhost:8000/api/crypto/dominance?days=1" | jq '.data[0]'
```

**Expected:**

```json
{
  "timestamp": "2026-01-21T00:00:00Z",
  "total_mcap": 3500000000000,
  "btc_dominance": 45.5,
  "eth_dominance": 17.2,
  "altcoin_mcap": 1305250000000
}
```

#### 3. Stock Data

```bash
curl -s "http://localhost:8000/api/stock/AAPL?period=1d&interval=1m" | jq
```

**Expected:**

```json
{
  "last_close": 225.50,
  "change": 2.75,
  "volatility": 0.012
}
```

#### 4. Macro Summary Endpoint

```bash
curl -s "http://localhost:8000/api/macro/summary?days=365" | jq 'keys'
```

**Expected:**

```json
[
  "cpi",
  "debt_status",
  "liquidity",
  "real_rates",
  "summary_metrics"
]
```

### Frontend API (via Proxy)

#### 1. Test Next.js → Backend Proxy

```bash
curl -s "http://localhost:3000/api/stock/BTC-USD?period=1d&interval=1m" | jq '.last_close'
```

**Expected:** Current BTC price (number)

#### 2. Test SSR Data Fetching

```bash
# View page source (should contain server-rendered data)
curl -s "http://localhost:3000/" | grep -o "Real-Time Stock Dashboard" || echo "Found"
```

**Expected:** `Real-Time Stock Dashboard` (or "Found")

---

## Frontend Chart Rendering

### Build-Time API URL Verification

**Critical:** Next.js requires `NEXT_PUBLIC_API_URL` to be set at **build time**.

#### 1. Check Environment Variable Injection

```bash
# Docker
docker-compose exec web printenv | grep NEXT_PUBLIC_API_URL

# Podman
podman exec cycle-navigator-web printenv | grep NEXT_PUBLIC_API_URL
```

**Expected:** `NEXT_PUBLIC_API_URL=http://backend:8000`

#### 2. Verify Bundled API URL

```bash
# Check static bundle contains correct URL
docker-compose exec web sh -c "grep -r 'http://backend:8000' /app/.next/static 2>/dev/null | head -5"
```

**Expected:** Should find references to `http://backend:8000` (not `undefined` or `localhost:8000`)

**If `undefined` is found:**
1. Rebuild with no cache: `docker-compose build --no-cache web`
2. Verify `build.args` in docker-compose.yml includes `NEXT_PUBLIC_API_URL`
3. Check [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) for troubleshooting steps

### Browser DevTools Verification

1. **Open Dashboard:** Navigate to [http://localhost:3000](http://localhost:3000)
2. **Open DevTools:** Press `F12` → **Network** tab
3. **Reload Page:** `Ctrl+R` or `Cmd+R`
4. **Check Requests:**
   - API calls should target `/api/stock/...`, `/api/macro/...`, etc.
   - Status should be **200 OK**
   - Response should contain valid JSON data
   - **No CORS errors** in Console tab
   - **No "Backend Offline"** errors

### Chart Interaction Tests

| Test | Action | Expected Behavior |
|------|--------|-------------------|
| **Chart Load** | Open macro dashboard | All charts render with data |
| **Crosshair** | Hover over chart | Crosshair appears with value overlay |
| **Expand Chart** | Click chart card | Modal opens with detailed chart view |
| **Resize** | Resize browser window | Charts update dimensions responsively |
| **Toggle CPI Adj** | Toggle "CPI Adj" switch | Chart updates to show adjusted values |
| **Timeframe** | Change timeframe selector | Chart updates with new data range |
| **Dominance Stacking** | View crypto dominance chart | Stacked areas visible (BTC blue, ETH purple, OTHERS green) |

### Chart Rendering Checklist

- [ ] **M2 Liquidity Card**: Chart loads with line graph
- [ ] **Debt Status Card**: Chart loads with area graph
- [ ] **Real Rates Card**: Chart loads (positive/negative values colored)
- [ ] **Crypto Dominance Card**: Stacked area chart (3 layers)
- [ ] **Stock Price Chart**: Candlestick or line chart renders
- [ ] **CPI Adjustment**: Toggle works and updates values to indexed (100)
- [ ] **No "Error Loading Data"**: All charts show data or loading state
- [ ] **No JavaScript Errors**: Console tab clean (no red errors)

---

## Database Verification

### Check Data Presence

#### FRED Series Data

```sql
-- Connect to database
psql postgresql://cycle_user:secure_password@localhost:5432/cycle_navigator

-- Check M2 data
SELECT COUNT(*) FROM fred_series_data WHERE series_id = 'M2SL';
-- Expected: >800 rows

-- Check latest data
SELECT * FROM fred_series_data 
WHERE series_id = 'M2SL' 
ORDER BY date DESC 
LIMIT 5;
```

#### Crypto Data

```sql
-- Check crypto data count
SELECT COUNT(*) FROM crypto_data;
-- Expected: >30 rows (daily snapshots)

-- Check latest snapshot
SELECT * FROM crypto_data 
ORDER BY timestamp DESC 
LIMIT 1;
```

#### Metadata Status

```sql
-- Check FRED fetch status
SELECT series_id, last_fetched, fetch_status 
FROM fred_series_metadata 
ORDER BY last_fetched DESC;

-- Check crypto fetch status
SELECT metric_type, last_fetched, fetch_status 
FROM crypto_metadata;
```

**Expected `fetch_status`:** `'success'` (not `'failed'` or `'rate_limited'`)

### TimescaleDB Verification

#### Check Hypertables

```sql
SELECT hypertable_name, num_chunks 
FROM timescaledb_information.hypertables;
```

**Expected:**

| hypertable_name | num_chunks |
|----------------|------------|
| fred_series_data | 12+ |
| crypto_data | 6+ |

#### Check Continuous Aggregates

```sql
SELECT view_name, materialization_hypertable_name 
FROM timescaledb_information.continuous_aggregates;
```

**Expected:**

| view_name | materialization_hypertable_name |
|-----------|--------------------------------|
| fred_monthly_aggregates | _materialized_hypertable_... |

#### Check Compression Status

```sql
SELECT 
  hypertable_name,
  compression_enabled,
  compress_after,
  compress_interval_length
FROM timescaledb_information.compression_settings;
```

**Expected:**

| hypertable_name | compression_enabled | compress_after |
|----------------|---------------------|----------------|
| fred_series_data | true | 90 days |
| crypto_data | true | 30 days |

---

## End-to-End Testing (Playwright)

### Setup Playwright

**Install Playwright (first time):**

```bash
# Activate virtual environment
source .venv/bin/activate  # Linux/macOS
.\.venv\Scripts\Activate.ps1  # Windows

# Install dev dependencies
pip install -r requirements-dev.txt

# Install Playwright browsers
python -m playwright install chromium
```

### Run E2E Tests

**Headless Mode:**

```bash
PLAYWRIGHT_HEADLESS=true python scripts/playwright/test_dashboard.py
```

**Headed Mode** (see browser):

```bash
python scripts/playwright/test_dashboard.py
```

### Test Coverage

The Playwright test suite verifies:

1. **Page Load**
   - Dashboard loads without errors
   - Title is correct
   - No console errors

2. **Chart Rendering**
   - Charts visible on page
   - Charts contain SVG/Canvas elements
   - No "Error Loading Data" messages

3. **Interactions**
   - Click chart to expand modal
   - Hover shows tooltip/crosshair
   - Timeframe selector changes data

4. **API Calls**
   - Network requests to `/api/*` succeed
   - Responses contain valid JSON
   - No 404 or 500 errors

5. **Performance**
   - Page load < 5 seconds
   - Chart render < 2 seconds
   - API response < 500ms

### Test Artifacts

**On Test Failure:**
- Screenshots saved to: `artifacts/failure-<timestamp>.png`
- Video recording saved to: `artifacts/video-<timestamp>.webm`
- Trace file saved to: `artifacts/trace-<timestamp>.zip`

**View trace:**

```bash
playwright show-trace artifacts/trace-<timestamp>.zip
```

---

## Performance Validation

### API Response Times

**Benchmark endpoints:**

```bash
# Macro summary (should be <100ms)
time curl -s "http://localhost:8000/api/macro/summary?days=365" > /dev/null

# Crypto dominance (should be <100ms)
time curl -s "http://localhost:8000/api/crypto/dominance?days=365" > /dev/null

# Stock data (should be <500ms - external API)
time curl -s "http://localhost:8000/api/stock/AAPL?period=1d&interval=1m" > /dev/null
```

**Expected:**
- **Cached endpoints**: <100ms
- **Database queries**: <200ms
- **External APIs (Yahoo Finance, FRED)**: <1000ms

### Database Query Performance

```sql
-- Enable timing
\timing on

-- Test M2 query (should be <50ms with continuous aggregates)
SELECT AVG(value) 
FROM fred_series_data 
WHERE series_id = 'M2SL' 
  AND date >= CURRENT_DATE - INTERVAL '1 year';

-- Test crypto query (should be <100ms)
SELECT * FROM crypto_data 
WHERE timestamp >= NOW() - INTERVAL '365 days' 
ORDER BY timestamp DESC;
```

### Redis Cache Hit Rate

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Check stats
INFO stats

# Look for:
# keyspace_hits: <high number>
# keyspace_misses: <low number>
# Hit rate = hits / (hits + misses)
```

**Expected Hit Rate:** >90% for frequently accessed endpoints

---

## Troubleshooting Matrix

### Issue: Charts Show "Error Loading Data"

| Possible Cause | Verification | Solution |
|---------------|--------------|----------|
| Backend offline | `curl http://localhost:8000/health` | `docker-compose restart backend` |
| Database empty | `SELECT COUNT(*) FROM fred_series_data;` | Run `scripts/init_db.py` |
| Redis cache cleared | `redis-cli KEYS *` | Restart Celery worker to repopulate |
| API key invalid | Check logs: `docker-compose logs backend` | Update `.env` with valid FRED_API_KEY |
| CORS error | Check browser console | Verify `NEXT_PUBLIC_API_URL` in build |

### Issue: API Returns Empty Arrays

| Possible Cause | Verification | Solution |
|---------------|--------------|----------|
| No data fetched yet | Check `fred_series_metadata.last_fetched` | Manually trigger: `celery -A backend.celery_app call backend.tasks.fred_tasks.update_all_fred_series` |
| Celery worker not running | `docker-compose ps celery-worker` | `docker-compose restart celery-worker` |
| Rate limit hit | Check `fetch_status = 'rate_limited'` | Wait 24 hours or use new API key |
| Database connection lost | Test: `psql $DATABASE_URL -c "SELECT 1;"` | Restart postgres: `docker-compose restart postgres` |

### Issue: Frontend Shows "Backend Offline"

| Possible Cause | Verification | Solution |
|---------------|--------------|----------|
| Wrong API URL in bundle | `grep -r 'undefined' /app/.next/static` | Rebuild with `--no-cache` and correct `NEXT_PUBLIC_API_URL` |
| Backend not accessible | `curl http://backend:8000/health` (from web container) | Check docker network: `docker network inspect cycle-navigator_default` |
| Port mismatch | Check docker-compose.yml ports | Ensure backend: `8000:8000`, web: `3000:3000` |

### Issue: Celery Tasks Not Running

| Possible Cause | Verification | Solution |
|---------------|--------------|----------|
| Celery Beat not running | `docker-compose ps celery-beat` | `docker-compose up -d celery-beat` |
| Module path changed | Check logs for `NotRegistered` error | Update task import path in `backend/celery_app.py` |
| Redis broker down | `redis-cli ping` | `docker-compose restart redis` |
| Task syntax error | `celery -A backend.celery_app inspect registered` | Check task code for errors |

### Issue: Database Migration Fails

| Possible Cause | Verification | Solution |
|---------------|--------------|----------|
| TimescaleDB not installed | `SELECT * FROM pg_extension WHERE extname='timescaledb';` | Use `timescale/timescaledb-ha:pg16` image |
| Permissions issue | `\du` (check user roles) | Grant superuser: `ALTER USER cycle_user WITH SUPERUSER;` |
| Already migrated | Check `SELECT * FROM timescaledb_information.hypertables;` | Skip migration, already applied |

---

## Continuous Verification (CI/CD)

### GitHub Actions Workflows

**CI Workflow** (`.github/workflows/ci.yml`):
- Runs on every push/PR
- Lints code with Ruff
- Runs pytest unit tests
- Builds containers
- Verifies dependencies

**E2E Workflow** (`.github/workflows/e2e.yml`):
- Runs on manual trigger or schedule
- Builds containers
- Starts full stack
- Runs Playwright tests
- Uploads failure artifacts

**Monitoring CI Status:**
- Check: [Actions tab](https://github.com/<owner>/<repo>/actions)
- Status badges in README.md

---

## Health Check Schedule

### Daily Checks (Automated via Celery)

- [x] FRED data refresh (2:00 AM UTC)
- [x] CoinGecko data refresh (2:15 AM UTC)
- [x] Redis cache update
- [x] Database compression (TimescaleDB policy)

### Weekly Checks (Manual)

- [ ] Review error logs: `docker-compose logs | grep ERROR`
- [ ] Check disk usage: `df -h`
- [ ] Review database size: `SELECT pg_size_pretty(pg_database_size('cycle_navigator'));`
- [ ] Verify backups exist: `ls -lh backups/`
- [ ] Test E2E suite: `python scripts/playwright/test_dashboard.py`

### Monthly Checks (Manual)

- [ ] Update dependencies: `pip list --outdated`
- [ ] Review API rate limit usage
- [ ] Analyze slow queries: `SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;`
- [ ] Test disaster recovery: Restore from backup
- [ ] Review security updates: `docker images --filter dangling=false`

---

## Related Documentation

- **[Technical Architecture](TECHNICAL_ARCHITECTURE.md)** - System design and performance benchmarks
- **[Developer Setup](DEVELOPER_SETUP.md)** - Local environment configuration
- **[Feature Guide](FEATURE_GUIDE.md)** - Feature implementations and testing
- **[Deployment Guide](DEPLOYMENT.md)** - CI/CD pipelines and production deployment

---

## Quick Verification Commands

**One-line health check:**

```bash
# Docker
docker-compose ps && \
curl -s http://localhost:8000/health && \
curl -s http://localhost:3000/ | head -1 && \
echo "✅ All systems operational"

# Podman
podman-compose ps && \
curl -s http://localhost:8000/health && \
curl -s http://localhost:3000/ | head -1 && \
echo "✅ All systems operational"
```

**Database data verification:**

```bash
psql $DATABASE_URL -c "
SELECT 'FRED data:' as source, COUNT(*) FROM fred_series_data
UNION ALL
SELECT 'Crypto data:', COUNT(*) FROM crypto_data;
"
```

**End-to-end test run:**

```bash
# Full stack test
docker-compose up -d && \
sleep 10 && \
PLAYWRIGHT_HEADLESS=true python scripts/playwright/test_dashboard.py && \
echo "✅ E2E tests passed"
```
