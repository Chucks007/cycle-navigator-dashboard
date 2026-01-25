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

**Related Files**:
- `backend/schemas.py`
- `backend/routers/crypto.py`
- `web/src/types/api.ts`

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

**Related Files**:
- `backend/cache_keys.py` (new)
- `backend/config.py`
- `backend/services/*.py`

---

## Quick Wins (1-2 hour fixes)

### 1. Create `scripts/init_crypto_data.py`

Formalize the synthetic data generation into a reproducible script.

**Time**: 30 minutes
**Effort**: Low
**Impact**: High (enables fresh deployments)

### 2. Add `backend/cache_keys.py`

Centralize all Redis key patterns in one file.

**Time**: 45 minutes
**Effort**: Low
**Impact**: Medium (reduces bugs, improves maintainability)

### 3. Create database migration with Alembic

Move from manual table creation to proper migrations.

**Time**: 1 hour
**Effort**: Low-Medium
**Impact**: High (production readiness)

### 4. Add startup validation

Fail fast if database or Redis is misconfigured.

**Time**: 30 minutes
**Effort**: Low
**Impact**: Medium (better error messages)

---

## Medium Effort Refactors

### 1. Generic Chart Preferences Hook Factory

Consolidate `macro-preferences.ts` and `ticker-preferences.ts` into single reusable pattern.

**Time**: 2-3 hours
**Effort**: Medium
**Impact**: High (maintainability, consistency)

### 2. API Schema Generation

Generate TypeScript client types from FastAPI OpenAPI schema.

**Time**: 3-4 hours
**Effort**: Medium
**Impact**: High (type safety, maintainability)

Setup:
- Add FastAPI OpenAPI decorators
- Install `swagger-typescript-api` or similar
- Generate client on build

### 3. Proper Error Handling & Loading UI

Add error boundaries, loading skeletons, and retry buttons.

**Time**: 3-4 hours
**Effort**: Medium
**Impact**: Medium (UX improvement)

### 4. Config Endpoint

Expose configuration from backend so frontend stays in sync.

**Time**: 1-2 hours
**Effort**: Low-Medium
**Impact**: Medium (reduces duplication)

---

## Implementation Priority

### Phase 1: Stability (Week 1)
1. Database initialization automation ⭐⭐⭐
2. Centralize cache keys ⭐⭐
3. Startup validation ⭐⭐
4. Formalize crypto data generation ⭐⭐

### Phase 2: Maintainability (Week 2-3)
5. Generic preferences store factory ⭐⭐
6. API client type generation ⭐⭐⭐
7. Consolidate configuration ⭐

### Phase 3: UX (Week 4)
8. Error boundaries and loading UI ⭐⭐
9. Response validation with Zod ⭐
10. Type consistency across layers ⭐

---

## Dependencies & Blockers

- Phase 1 can start immediately
- Phase 2 depends on Phase 1 completion
- Phase 3 independent, can run in parallel

---

## Notes for Future Developers

- These refactors are **not blocking** current functionality
- Start with Phase 1 quick wins for immediate stability gains
- Document decisions in this file as implementation progresses
- Consider code review process for architectural changes

---

## Related Documentation

- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - Current system design
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment procedures
- [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) - Development environment setup
