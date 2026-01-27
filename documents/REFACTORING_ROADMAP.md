# Refactoring & Improvement Roadmap

This document lists the remaining refactoring work.

---

## Completed Work

### ✅ Issue 19: Repetitive Macro Card Components (Frontend) ⭐⭐

**Status**: COMPLETED

**Problem**: Three macro cards shared ~80% identical structure.

**Solution Implemented**:
- Created a generic `MacroMetricCard` component in [`web/src/components/macro/macro-metric-card.tsx`](../web/src/components/macro/macro-metric-card.tsx)
- Refactored all three macro cards to use the new component:
  - [`web/src/components/macro/liquidity-card.tsx`](../web/src/components/macro/liquidity-card.tsx)
  - [`web/src/components/macro/debt-status-card.tsx`](../web/src/components/macro/debt-status-card.tsx)
  - [`web/src/components/macro/real-rates-card.tsx`](../web/src/components/macro/real-rates-card.tsx)

**Impact**: Reduced ~400 lines to ~150 lines across the three cards. The new generic component consolidates:
- Common imports and error rendering
- ChartDisplay toggle patterns
- SMA/EMA indicator series logic
- getVariant() functions
- All chart configuration and rendering logic

---

### ✅ Issue 20: Duplicate SMA Indicator Series Logic (Frontend) ⭐

**Status**: COMPLETED

**Problem**: Same SMA/EMA calculation pattern repeated in each macro card.

**Solution Implemented**:
- Added `createIndicatorSeries` utility function to [`web/src/lib/chart-utils.ts`](../web/src/lib/chart-utils.ts)
- The utility handles creation of SMA/EMA overlay series with configurable options
- Now used by the generic `MacroMetricCard` component

**Impact**: Eliminated code duplication and made indicator series creation consistent across all macro cards.

---

## Status Summary

- **Phase 5**: ✅ COMPLETED — All tasks finished
- **System**: 🟢 Stable and production-ready
- **Tests**: ✅ All frontend (typecheck) and backend (96 tests) passing
- **Build**: ✅ Docker containers build successfully
