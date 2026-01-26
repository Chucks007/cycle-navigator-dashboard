# Refactoring & Improvement Roadmap

This document tracks code quality and architectural improvements.

**Status Summary**:
- ✅ **Phases 1-4 Complete**: 14/14 tasks completed (database automation, caching, validation, deployment)
- ✅ **Phase 5 Partial**: 4/6 tasks completed (datetime fixes, error handling, code consolidation)
- 🟢 **Remaining**: 2 frontend refactoring items (lower priority)

---

## Completed Phases Summary

### ✅ Phase 1: Stability (4/4 complete)
- Database initialization automation
- Centralize cache keys  
- Startup validation
- Formalize crypto data generation

### ✅ Phase 2: Maintainability (4/4 complete)
- Generic preferences store factory
- API client type generation
- Consolidate configuration
- Error boundaries and loading UI

### ✅ Phase 3: UX (2/2 complete)
- Response validation with Zod
- Type consistency across layers

### ✅ Phase 4: Docker & Deployment (4/4 complete)
- Fix Celery anti-pattern in FRED tasks
- Auto-initialize database tables
- Add persistent database volume
- Refactor cache initialization logic

### ✅ Phase 5: Code Quality (4/6 complete)
- ✅ Issue 15: Replace `datetime.utcnow()` with `datetime.now(timezone.utc)` (20+ instances across 6 files)
- ✅ Issue 16: Create `@handle_api_errors` decorator (applied to 6 routers, reduced 100+ lines)
- ✅ Issue 17: Consolidate FRED_SERIES_LIST to config.py (single source of truth)
- ✅ Issue 18: Create CachedDataService base class (refactored MacroService & CryptoService)

---

## Remaining Work

### Phase 5: Code Quality & DRY Improvements (2/6 remaining)

#### Issue 19: Repetitive Macro Card Components (Frontend) ⭐⭐

**Problem**: Three macro cards share ~80% identical structure.

**Affected Files**:
- `web/src/components/macro/liquidity-card.tsx`
- `web/src/components/macro/debt-status-card.tsx`
- `web/src/components/macro/real-rates-card.tsx`

**Duplicated Patterns**:
- Same imports and error rendering
- Same `ChartDisplay` toggle patterns
- Same SMA/EMA indicator series logic
- Nearly identical `getVariant()` functions

**Solution**: Create a generic `MacroMetricCard` component factory or shared hook.

**Effort**: High | **Impact**: High (reduces ~400 lines to ~150)

---

#### Issue 20: Duplicate SMA Indicator Series Logic (Frontend) ⭐

**Problem**: Same SMA/EMA calculation pattern repeated in each macro card.

**Affected Files**:
- All macro card components
- `web/src/components/charts/chart-utils.ts`

**Solution**: Add utility to `chart-utils.ts`:
```typescript
export function createIndicatorSeries(
  data: Array<{ date: string; sma?: number | null; ema?: number | null }>,
  options: { showSMA?: boolean; showEMA?: boolean }
): ExtraSeriesConfig[] { ... }
```

**Effort**: Low | **Impact**: Medium

---

## Status Summary

- **Phase 1-4**: ✅ Complete (14/14 tasks)
- **Phase 5**: ✅ Mostly complete (4/6 tasks) - Issues 19-20 are lower priority frontend optimizations
- **System**: 🟢 Stable and production-ready
