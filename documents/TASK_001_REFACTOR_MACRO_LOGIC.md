# Task 001: Refactor Logic Leakage in Macro Router

**Status**: Completed
**Priority**: High
**Created**: 2026-01-26
**Completed**: 2026-01-27

## Context
The `backend/routers/macro.py` file currently contains business logic within the `get_macro_summary` endpoint. Specifically, it manually calculates "latest" summary metrics (M2 Growth, Debt-to-Tax Ratio, Real Rate) by extracting the last element from data series.

This violates the **Separation of Concerns** principle. Routers should handle HTTP request/response mechanics, while Services should handle business logic and data manipulation.

## Problem Code
**Location**: `backend/routers/macro.py`

```python
# ... inside get_macro_summary ...
liquidity = macro_service.get_liquidity(days=days, include_metadata=True)
debt_status = macro_service.get_debt_status(days=days, include_metadata=True)
real_rates = macro_service.get_real_rates(include_metadata=True)
cpi = macro_service.get_cpi_series(include_metadata=True)

# LOGIC LEAKAGE HERE:
latest_m2 = liquidity['data'][-1] if liquidity['data'] else None
latest_debt = debt_status['data'][-1] if debt_status['data'] else None
latest_rates = real_rates['data'][-1] if real_rates['data'] else None

summary = schemas.MacroMetrics(
    m2_supply=latest_m2.value if latest_m2 else 0.0,
    m2_growth=latest_m2.growth_rate if latest_m2 and hasattr(latest_m2, 'growth_rate') else 0.0,
    debt_to_tax_ratio=latest_debt.ratio if latest_debt else 0.0,
    real_rate=latest_rates.real_rate if latest_rates else 0.0,
)
```

## Objective
Move the calculation and aggregation logic into `MacroService`.

## Implementation Plan

### 1. Update `MacroService`
Add a new method `get_dashboard_summary(self, days: int = None)` to `backend/services/macro.py`.
- This method should fetch the individual components (Liquidity, Debt, Rates, CPI).
- It should perform the "latest value" extraction logic currently found in the router.
- It should return a structured object (or dictionary) containing both the series data and the summary metrics.

### 2. Update `MacroRouter`
Refactor `get_macro_summary` in `backend/routers/macro.py` to:
- Call the new `macro_service.get_dashboard_summary(days)`.
- Map the result directly to the `MacroSummaryResponse`.

### 3. Verification
- Ensure the API endpoint returns the exact same JSON structure as before.
- Run existing tests to ensure no regression.

## Benefits
- **Testability**: The summary calculation logic can be unit tested without mocking HTTP requests.
- **Reusability**: Other parts of the system (e.g., alert jobs) can fetch the dashboard summary without calling the API.
- **Cleanliness**: Router becomes a dumb pass-through, reducing code complexity.
