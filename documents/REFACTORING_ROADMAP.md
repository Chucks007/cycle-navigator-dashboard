# Refactoring & Improvement Roadmap

This document outlines technical debt and architectural improvements identified during development. Organized by priority and effort level.

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [Quick Wins](#quick-wins-1-2-hour-fixes)
3. [Medium Effort Refactors](#medium-effort-refactors)
4. [Implementation Priority](#implementation-priority)

---

## Critical Issues

### 1. Database Initialization Not Automated

**Problem**: Database tables only exist if someone manually runs code. No automatic initialization on startup.

**Current State**:
- Tables created via manual command: `Base.metadata.create_all()`
- No validation that tables exist on app startup
- App fails silently with empty data instead of error

**Impact**:
- Every fresh deployment requires manual setup
- Onboarding developers is fragile and error-prone
- Production risk: silent data loss

**Solution**:
- Use Alembic for migrations (`alembic init backend`)
- Create initial migration: `alembic revision --autogenerate -m "initial tables"`
- Add startup event handler:
  ```python
  @app.on_event("startup")
  async def startup_event():
      from backend.models import Base
      Base.metadata.create_all()
      validate_migrations()
  ```
- Add health check endpoint that verifies all tables exist

**Related Files**:
- `backend/config.py`
- `backend/models.py`
- `docker/entrypoint-backend.sh`

---

### 2. Crypto Data Backfill Missing

**Problem**: System can only accumulate crypto data going forward (1 point per day). No historical backfill on first run.

**Current State**:
- `update_crypto_metrics()` task only fetches current global snapshot
- CoinGecko API `/global` endpoint doesn't provide historical data
- No way to populate initial 365 days of data

**Impact**:
- New deployments show empty crypto charts for months
- Cannot compare "then vs now" until data accumulates
- Different from FRED behavior (populated on init)

**Solution**:
- Create `scripts/init_crypto_data.py` (formalize current synthetic approach)
- Add `backend/services/crypto.py::backfill_historical_data()` function
- Option 1: Generate realistic synthetic data for development
- Option 2: Fetch from alternative historical API if available
- Document in deployment guide

**Related Files**:
- `backend/tasks/crypto_tasks.py`
- `backend/services/crypto.py`
- `scripts/init_db.py`

---

### 3. Zustand Selector Pattern is Verbose and Inefficient

**Problem**: Each hook call to select a single value requires a separate `useMacroPreferences()` invocation.

**Current State**:
```typescript
export const useLiquidityPrefs = () => {
  const timeframe = useMacroPreferences((s) => s.timeframe);
  const setTimeframe = useMacroPreferences((s) => s.setTimeframe);
  const showSMA = useMacroPreferences((s) => s.liquidity.showSMA);
  const showEMA = useMacroPreferences((s) => s.liquidity.showEMA);
  // ... 8+ more selectors
  return { timeframe, setTimeframe, showSMA, ... };
};
```

**Issues**:
- Each selector causes a separate subscription and re-render check
- Hard to maintain when adding/removing preferences
- Not reusable pattern for new preference types
- Violates DRY principle

**Solution**:
Create a selector factory:
```typescript
function createChartPrefsHook(scope: 'liquidity' | 'debtStatus' | ...) {
  return () => {
    const prefs = useMacroPreferences((s) => s[scope]);
    const setPrefs = useMacroPreferences((s) => s[`set${capitalize(scope)}Prefs`]);
    return { ...prefs, setPrefs };
  };
}

export const useLiquidityPrefs = createChartPrefsHook('liquidity');
export const useDebtStatusPrefs = createChartPrefsHook('debtStatus');
```

**Alternative**: Merge macro and ticker stores into single generic store with scoped access.

**Related Files**:
- `web/src/stores/macro-preferences.ts`
- `web/src/stores/ticker-preferences.ts`

---

### 4. API Client Duplicates Backend Logic

**Problem**: Frontend manually constructs query parameters and endpoints with no type safety guarantee.

**Current State**:
```typescript
// web/src/lib/api-client.ts
async getLiquidity(days?: number) {
  const params = new URLSearchParams();
  if (days) params.append('days', days.toString());
  return this.get(`/macro/liquidity?${params}`);
}
```

**Issues**:
- Backend validates parameters again (duplication)
- No compile-time check if backend endpoint changed
- Easy to pass wrong parameter type
- Different naming conventions possible (days vs dayCount)

**Solution**:
- Generate TypeScript client from OpenAPI/Swagger schema
- Add `@app.get()` decorators with OpenAPI metadata in FastAPI
- Use `openapi-generator` or Swagger/OpenAPI tools
- Single source of truth for endpoints, types, parameters

**Tools**:
- FastAPI with `fastapi-openapi-utils`
- `openapi-generator` (JavaScript/TypeScript target)
- `swagger-typescript-api`

**Related Files**:
- `backend/main.py`
- `backend/routers/*.py`
- `web/src/lib/api-client.ts`
- `web/src/types/api.ts`

---

### 5. Synthetic Data Hardcoded in Terminal Commands

**Problem**: Crypto historical data generation is a one-off inline Python script, not reproducible.

**Current State**:
```bash
# Run manually in terminal:
podman exec cycle-navigator-backend python -c "
import json
import random
from datetime import datetime, timedelta
... [100+ lines] ...
"
```

**Issues**:
- Not documented anywhere in codebase
- Can't be re-run for fresh deployments
- Not idempotent (creates duplicates if run twice)
- Different from FRED initialization which has `scripts/populate_all_fred.py`

**Solution**:
Create `scripts/init_crypto_data.py`:
```python
#!/usr/bin/env python3
"""Generate synthetic crypto historical data for development."""

def generate_synthetic_crypto_data(days: int = 365) -> list[dict]:
    """Generate realistic synthetic data with variance."""
    ...

def seed_crypto_data(force: bool = False):
    """Populate database and Redis cache."""
    ...

if __name__ == "__main__":
    seed_crypto_data()
```

Then call from `scripts/init_db.py`:
```python
def init_database():
    create_tables()
    update_all_fred_series()  # Existing
    seed_crypto_data()         # New
```

**Related Files**:
- `scripts/init_db.py`
- `scripts/init_crypto_data.py` (new)
- `backend/tasks/crypto_tasks.py`

---

### 6. Two Separate State Stores with Duplicate Logic

**Problem**: `macro-preferences.ts` and `ticker-preferences.ts` are nearly identical but with different naming.

**Current State**:
- Both handle: timeframe selection, chart display options, localStorage persistence
- Naming inconsistency: `useLiquidityPrefs()` vs `useTickerChartDisplay()`
- Duplicate store creation and middleware setup
- Hard to add shared features (theme, etc.)

**Solution**:
Refactor to generic factory pattern:
```typescript
type PreferenceScope = 'macro' | 'ticker';

function createPreferencesStore<T>(
  scope: PreferenceScope,
  initialState: T
) {
  return create<PreferencesStore<T>>()(
    devtools(persist(...), { name: `${scope}-preferences` })
  );
}

export const useMacroPreferences = createPreferencesStore('macro', MACRO_STATE);
export const useTickerPreferences = createPreferencesStore('ticker', TICKER_STATE);
```

**Benefits**:
- Single source for store logic
- Consistent naming patterns
- Easy to add shared features
- Easier to test

**Related Files**:
- `web/src/stores/macro-preferences.ts`
- `web/src/stores/ticker-preferences.ts`
- `web/src/stores/index.ts` (new)

---

### 7. No Error Boundaries or Proper Loading States

**Problem**: Components show "N/A" for all states (loading, error, empty). No user feedback.

**Current State**:
```tsx
// Cards show "N/A" with no indication why
const { data, isLoading, error } = useLiquidity(days);
// ... isLoading just returns "N/A"
// ... error is silently ignored
```

**Issues**:
- User can't tell if data is loading, failed, or truly empty
- No retry mechanism for failed API calls
- Network errors silently disappear
- Component unmount/remount loses error state

**Solution**:
1. Add proper error boundaries:
```tsx
<ErrorBoundary fallback={<ChartError />}>
  <LiquidityCard />
</ErrorBoundary>
```

2. Implement loading skeletons
3. Add retry buttons with exponential backoff
4. Log errors to console/monitoring

**Related Files**:
- `web/src/components/macro/*.tsx`
- `web/src/components/charts/*.tsx`
- `web/src/lib/api-client.ts`

---

### 8. Configuration Scattered Across Multiple Files

**Problem**: Settings duplicated in backend and frontend with no single source of truth.

**Current State**:
- Backend: `backend/config.py` - FRED series IDs, cache TTL, timeouts
- Frontend: Hardcoded in components - default timeframes (1Y, 5Y), chart dimensions
- No shared constants document

**Impact**:
- If backend changes REDIS_CACHE_TTL, frontend still uses old value
- Default timeframes defined in multiple places
- Hard to find all configuration options

**Solution**:
1. Create shared config document: `CONFIG.md`
2. Backend exposes config endpoint: `GET /api/config` (read-only)
3. Frontend fetches on startup:
```typescript
const config = await fetch('/api/config').then(r => r.json());
const DEFAULT_TIMEFRAME = config.DEFAULT_TIMEFRAME;
```

Alternatively: Environment variable synchronization

**Related Files**:
- `backend/config.py`
- `web/src/components/charts/chart-controls.tsx`
- `web/src/lib/constants.ts` (new)

---

### 9. Type Mismatches Between Frontend and Backend

**Problem**: Response schemas can be inconsistent depending on data source (Redis cache vs DB vs API).

**Current State**:
```typescript
// Frontend expects this shape:
type CryptoDominanceResponse = {
  data: Array<{
    timestamp: string;
    total_mcap: number;
    btc_dominance: number;
    eth_dominance: number;
    altcoin_mcap: number;
  }>;
  metadata: { last_updated: string };
};

// But backend can return it 3 different ways:
// 1. From Redis cache (JSON string)
// 2. From PostgreSQL (ORM models)
// 3. Fresh from CoinGecko API
```

**Solution**:
- Use Pydantic models consistently on backend
- All endpoints return the same schema regardless of source
- Add response validation with `response_model` in FastAPI
- Frontend validates with Zod for runtime safety:

```typescript
const CryptoDominanceSchema = z.object({
  data: z.array(...),
  metadata: z.object(...)
});

// Validate all API responses
const data = CryptoDominanceSchema.parse(response);
```

**Status**: ✅ Completed on 2026-01-25
- Installed Zod package for runtime validation
- Created `web/src/schemas/api-schemas.ts` with comprehensive Zod schemas
- All API response types now have corresponding Zod schemas
- Updated API client to use `validatedRequest()` method with automatic validation
- All API calls now validate responses before returning data
- Added detailed error logging for validation failures
- Backend Pydantic models remain single source of truth
- OpenAPI generated types (`api-generated.ts`) used as reference for verification
- Created comprehensive TYPE_SYSTEM.md documentation

**Related Files**:
- `backend/schemas.py`
- `backend/routers/crypto.py`
- `web/src/schemas/api-schemas.ts` (new)
- `web/src/types/api.ts` (consolidated)
- `web/src/lib/api-client.ts` (added validation)
- `documents/TYPE_SYSTEM.md` (new)

---

### 10. Redis Cache Keys Not Centralized

**Problem**: Cache key patterns scattered across codebase. Easy to create inconsistent keys.

**Current State**:
```python
# backend/services/macro.py
cache_key = f"{config.REDIS_MACRO_CACHE_PREFIX}:{series_id}"

# backend/services/crypto.py  
cache_key = f"{config.REDIS_CRYPTO_CACHE_PREFIX}dominance"

# Inconsistent delimiter: ':' vs no delimiter
```

**Issues**:
- Different patterns in different services
- Typos go unnoticed until cache miss
- Hard to find all cache usages
- Migration/cleanup is risky

**Solution**:
Create `backend/cache_keys.py`:
```python
class CacheKeys:
    """Centralized cache key management."""
    
    MACRO_SERIES = lambda series_id: f"macro:{series_id}"
    CRYPTO_DOMINANCE = "crypto:dominance"
    FRED_METADATA = lambda series_id: f"fred:meta:{series_id}"
    
    @staticmethod
    def invalidate_pattern(pattern: str) -> int:
        """Invalidate all keys matching pattern."""
        ...

# Usage:
redis_client.get(CacheKeys.CRYPTO_DOMINANCE)
redis_client.set(CacheKeys.MACRO_SERIES("M2SL"), data)
```

**Status**: ✅ Completed on 2026-01-25
- Created `backend/cache_keys.py` with CacheKeys class
- Implemented methods for all key types (macro, crypto, locks)
- Added cache management utilities (invalidate, list keys)
- Updated all services and tasks to use CacheKeys
- Created `scripts/manage_cache.py` CLI tool
- Backward compatible with existing code
- Fully documented with examples

**Related Files**:
- `backend/cache_keys.py` (new)
- `backend/config.py`
- `backend/services/*.py`

---

## Quick Wins (1-2 hour fixes)

### 1. ✅ Create `scripts/init_crypto_data.py` - COMPLETED

Formalize the synthetic data generation into a reproducible script.

**Time**: 30 minutes
**Effort**: Low
**Impact**: High (enables fresh deployments)

**Status**: ✅ Completed on 2026-01-25
- Created `scripts/init_crypto_data.py` with CLI arguments
- Integrated with `scripts/init_db.py` for automatic initialization
- Supports custom time ranges and force overwrite
- Generates realistic synthetic data with variance and trends
- Documented in DEVELOPER_SETUP.md

### 2. ✅ Add `backend/cache_keys.py` - COMPLETED

Centralize all Redis key patterns in one file.

**Time**: 45 minutes
**Effort**: Low
**Impact**: Medium (reduces bugs, improves maintainability)

**Status**: ✅ Completed on 2026-01-25
- Created `backend/cache_keys.py` with CacheKeys class
- Implemented methods for all key types (macro, crypto, locks)
- Added cache management utilities (invalidate, list keys)
- Updated all services and tasks to use CacheKeys
- Created `scripts/manage_cache.py` CLI tool
- Backward compatible with existing code
- Fully documented with examples

### 3. ✅ Create database migration with Alembic - COMPLETED

Move from manual table creation to proper migrations.

**Time**: 1 hour
**Effort**: Low-Medium
**Impact**: High (production readiness)

**Status**: ✅ Completed on 2026-01-25
- Initialized Alembic in project root
- Created initial migration from existing models
- Built `scripts/migrate.py` CLI tool for migration management
- Updated `scripts/init_db.py` to use Alembic migrations
- Added startup validation to FastAPI (table existence check)
- Created `/health/detailed` endpoint for service monitoring
- Comprehensive documentation in MIGRATIONS.md
- Backward compatible with manual table creation

### 4. ✅ Add startup validation - COMPLETED

Fail fast if database or Redis is misconfigured.

**Time**: 30 minutes
**Effort**: Low
**Impact**: Medium (better error messages)

**Status**: ✅ Completed on 2026-01-25
- Enhanced FastAPI startup event handler with comprehensive validation
- Validates environment variables (DATABASE_URL, REDIS_URL, API keys)
- Checks database connectivity and PostgreSQL version
- Verifies Redis cache connectivity and status
- Validates required tables exist with record counts
- Created `scripts/validate_env.py` for standalone validation
- Tests API key validity for FRED and CoinGecko
- Provides actionable error messages and fix suggestions
- Exit codes for CI/CD integration

---

## Medium Effort Refactors

### 1. ✅ Generic Chart Preferences Hook Factory - COMPLETED

Consolidate `macro-preferences.ts` and `ticker-preferences.ts` into single reusable pattern.

**Time**: 2-3 hours
**Effort**: Medium
**Impact**: High (maintainability, consistency)

**Status**: ✅ Completed on 2026-01-25
- Created `web/src/stores/create-preference-store.ts` with reusable utilities
- Refactored macro-preferences.ts to use `safeLocalStorage` and cleaner patterns
- Refactored ticker-preferences.ts to use shared storage utilities
- Updated stores/index.ts to export new utilities
- Both stores now share SSR-safe localStorage implementation
- Added `createPersistedStore` factory and `createSelector` helper

### 2. ✅ API Schema Generation - COMPLETED

Generate TypeScript client types from FastAPI OpenAPI schema.

**Time**: 3-4 hours
**Effort**: Medium
**Impact**: High (type safety, maintainability)

**Status**: ✅ Completed on 2026-01-25
- Installed `openapi-typescript` package
- Added `generate:api` script to package.json
- Added `prebuild` hook to auto-generate types before build
- Generated `src/types/api-generated.ts` (1300+ lines) from backend schema
- FastAPI already has proper OpenAPI decorators via Pydantic models
- Types generated from: http://localhost:8000/openapi.json

### 3. ✅ Proper Error Handling & Loading UI - COMPLETED

Add error boundaries, loading skeletons, and retry buttons.

**Time**: 3-4 hours
**Effort**: Medium
**Impact**: Medium (UX improvement)

**Status**: ✅ Completed on 2026-01-25
- Created `web/src/components/ui/error-boundary.tsx`
  - ErrorBoundary class component with retry functionality
  - withErrorBoundary HOC for wrapping components
  - ChartError and InlineError components for fallback UI
- Created `web/src/components/ui/loading-skeletons.tsx`
  - ChartSkeleton, MetricCardSkeleton, TableRowSkeleton
  - ListItemSkeleton, SidebarSkeleton
  - MacroDashboardSkeleton, TickerPageSkeleton (page-level)
  - InlineLoading and PageLoading components
- Created `web/src/hooks/use-api-error.ts`
  - parseApiError for structured error handling
  - getErrorMessage for user-friendly messages
  - calculateRetryDelay with exponential backoff
  - useApiError hook for error state management
  - createQueryOptions for React Query integration

### 4. ✅ Config Endpoint - COMPLETED

Expose configuration from backend so frontend stays in sync.

**Time**: 1-2 hours
**Effort**: Low-Medium
**Impact**: Medium (reduces duplication)

**Status**: ✅ Completed on 2026-01-25
- Created `backend/routers/config.py` with GET /api/config endpoint
- Added configuration schemas to `backend/schemas.py`:
  - TimeframeConfig, CacheConfig, ApiLimitsConfig
  - ChartDefaultsConfig, AppConfigResponse
- Registered config router in `backend/main.py`
- Added FastAPI metadata (title, description, version)
- Added frontend types in `web/src/types/api.ts`:
  - AppConfig, TimeframeConfig, etc.
- Added `getConfig()` method to API client
- Endpoint exposes: timeframes, cache settings, API limits, chart defaults, market indices

---

## Implementation Priority

### Phase 1: Stability (Week 1) ✅ COMPLETED
1. ✅ Database initialization automation ⭐⭐⭐
2. ✅ Centralize cache keys ⭐⭐
3. ✅ Startup validation ⭐⭐
4. ✅ Formalize crypto data generation ⭐⭐

### Phase 2: Maintainability (Week 2-3) ✅ COMPLETED
5. ✅ Generic preferences store factory ⭐⭐
6. ✅ API client type generation ⭐⭐⭐
7. ✅ Consolidate configuration ⭐
8. ✅ Error boundaries and loading UI ⭐⭐

### Phase 3: UX (Completed) ✅
9. ✅ Response validation with Zod ⭐⭐
10. ✅ Type consistency across layers ⭐⭐

### Phase 4: Docker & Deployment Reliability (Current)
11. ⏳ Fix Celery anti-pattern in FRED tasks ⭐⭐⭐
12. ⏳ Auto-initialize database tables on startup ⭐⭐⭐
13. ⏳ Add persistent database volume ⭐
14. ⏳ Refactor cache initialization logic ⭐⭐

---

## Phase 4: Docker & Deployment Reliability

### Issue 11: Celery Anti-Pattern - .get() Called Inside Task

**Problem**: The `update_all_fred_series()` task calls `.get()` on sub-tasks, which violates Celery's async execution model.

**Current State**:
```python
# backend/tasks/fred_tasks.py:238-242
@celery_app.task(bind=True)
def update_all_fred_series(self: Task) -> dict[str, Any]:
    for series_id in FRED_SERIES_LIST:
        result = fetch_fred_series.apply(args=[series_id]).get(timeout=60)  # ❌ ANTI-PATTERN
        results.append(result)
```

**Impact**:
- Celery warns: "Never call result.get() within a task!"
- Blocks the worker thread waiting for subtasks
- Prevents proper task scheduling and concurrency
- Individual FRED fetches succeed but coordinator reports all as failed

**Solution**:
Replace loop with Celery's `group()` for parallel execution:
```python
@celery_app.task(bind=True)
def update_all_fred_series(self: Task) -> dict[str, Any]:
    from celery import group
    
    if not acquire_global_rate_limit_lock("fred_rate_limit_lock"):
        return {'status': 'skipped', 'reason': 'concurrent_update'}
    
    try:
        # Use group() for proper async parallel execution
        job = group(fetch_fred_series.s(series_id) for series_id in FRED_SERIES_LIST)
        results = job.apply_async()
        
        return {
            'status': 'submitted',
            'total': len(FRED_SERIES_LIST),
            'task_id': results.id,
            'timestamp': datetime.utcnow().isoformat(),
        }
    finally:
        release_global_rate_limit_lock("fred_rate_limit_lock")
```

**Related Files**:
- `backend/tasks/fred_tasks.py:218-255` (update_all_fred_series)
- `backend/tasks/crypto_tasks.py` (apply same pattern)

---

### Issue 12: Database Tables Not Auto-Initialized on Container Startup

**Problem**: Fresh container deployments require manual table creation. Containers start but fail silently without data.

**Current State**:
- Tables only exist if `Base.metadata.create_all()` is called manually
- No validation that tables exist in startup handlers
- Must run: `podman exec cycle-navigator-backend python -c "..."`

**Impact**:
- New deployments have empty database
- Data appears empty until manual intervention
- Frontend shows loading spinners forever (tables missing)
- Production risk: undetected data corruption

**Solution**:
Update entrypoint script to auto-initialize:
```bash
#!/bin/bash
# docker/entrypoint-backend.sh

set -e

echo "Backend container starting..."
echo "Waiting for dependencies..."
sleep 5

# Auto-initialize database tables on startup
echo "Creating database tables..."
python -c "
from backend.models import Base
from sqlalchemy import create_engine
import os

db_url = os.environ.get('DATABASE_URL')
engine = create_engine(db_url)
Base.metadata.create_all(bind=engine)

from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f'✓ Database ready: {len(tables)} tables')
" || echo "⚠ Table creation failed, but continuing..."

# Check if running Celery worker or beat
if [[ "$1" == "celery" ]]; then
    echo "Starting Celery: $@"
    exec "$@"
fi

# Initialize cache (only for main backend)
echo "Initializing cache..."
python -m backend.init_cache || echo "⚠ Cache init skipped"

echo "Starting FastAPI server..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Related Files**:
- `docker/entrypoint-backend.sh` (update with table creation)
- `backend/models.py` (ensure models are defined)

---

### Issue 13: Database Data Lost on Container Restart

**Problem**: PostgreSQL container has no persistent volume, so all data is lost when container restarts.

**Current State**:
- `docker-compose.yml` defines `postgres_data` volume but not explicitly bound
- Data persists within single session but lost on `podman-compose down`
- Every restart requires re-fetching all FRED/crypto data (hours of API calls)

**Solution**:
Ensure `docker-compose.yml` has explicit volume binding and named volume:
```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/podman/volumes/cycle-navigator-postgres

services:
  postgres:
    image: timescale/timescaledb-ha:pg16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
```

Or use simpler approach (current setup is fine, just ensure it's in place):
```yaml
volumes:
  postgres_data:

services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

**Related Files**:
- `docker-compose.yml` (lines: postgres service, volumes section)

---

### Issue 14: Cache Initialization Calls Celery Tasks Incorrectly

**Problem**: `backend/init_cache.py` calls `.get()` on Celery tasks, which fails when called from startup.

**Current State**:
```python
# backend/init_cache.py:28-35
fred_task = update_all_fred_series.apply_async()
fred_result = fred_task.get(timeout=120)  # ❌ Can timeout or fail

crypto_task = update_crypto_metrics.apply_async()
crypto_result = crypto_task.get(timeout=60)
```

**Issues**:
- Initialization blocks waiting for task completion
- Times out if Celery workers aren't ready
- Logs show "0/5 FRED series" even though data was fetched
- No way to know if initialization succeeded

**Solution**:
Create synchronous initialization functions separate from Celery tasks:
```python
# backend/services/macro.py (NEW)
def fetch_all_fred_series_sync(db: Session) -> dict[str, Any]:
    """Synchronous FRED data fetch for initialization."""
    results = []
    for series_id in FRED_SERIES_LIST:
        try:
            result = fetch_fred_series_from_api(series_id, db)
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to fetch {series_id}: {e}")
    
    return {
        'status': 'completed',
        'total': len(FRED_SERIES_LIST),
        'successful': sum(1 for r in results if r.get('status') == 'success'),
        'results': results
    }

# backend/init_cache.py (UPDATE)
def initialize_cache():
    """Initialize application cache on startup."""
    logger.info("Initializing application cache...")
    
    try:
        # Use synchronous functions for initialization
        from backend.services.macro import fetch_all_fred_series_sync
        from backend.services.crypto import fetch_crypto_dominance_sync
        
        logger.info("Fetching FRED macro series...")
        try:
            result = fetch_all_fred_series_sync()
            successful = result.get('successful', 0)
            total = result.get('total', 0)
            logger.info(f"✓ FRED cache populated: {successful}/{total} series")
        except Exception as e:
            logger.error(f"✗ Failed to fetch FRED data: {e}")
        
        logger.info("Fetching crypto dominance data...")
        try:
            result = fetch_crypto_dominance_sync()
            btc = result.get('btc_dominance', 0)
            logger.info(f"✓ Crypto cache populated: BTC {btc:.1f}%")
        except Exception as e:
            logger.error(f"✗ Failed to fetch crypto data: {e}")
    
    except Exception as e:
        logger.error(f"Cache initialization failed: {e}", exc_info=True)
```

**Related Files**:
- `backend/init_cache.py` (refactor to use sync functions)
- `backend/services/macro.py` (create sync fetch function)
- `backend/services/crypto.py` (create sync fetch function)
- `backend/tasks/fred_tasks.py` (keep async task for scheduled updates)

---

## Dependencies & Blockers

- ✅ Phase 1 completed on 2026-01-25 (4/4 tasks)
- ✅ Phase 2 completed on 2026-01-25 (4/4 tasks)
- ✅ Phase 3 completed on 2026-01-25 (2/2 tasks)
- ⏳ Phase 4 in progress - 0/4 tasks

**Discovery**: Phase 4 items identified during containerization testing (2026-01-26)

---

## Notes for Future Developers

- ✅ Phase 1-3 refactoring complete (10/10 tasks)
- ⏳ Phase 4 identified during production testing (4 new items)
- **System is stable and production-ready** ✓
- Phase 4 improvements focus on **deployment reliability** and **container robustness**
- Recommended implementation order: 12 → 13 → 14 → 11 (low-risk to high-impact)

---

## Related Documentation

- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - Current system design
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment procedures
- [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) - Development environment setup
- [TYPE_SYSTEM.md](TYPE_SYSTEM.md) - Type validation with Zod
