# Task 012: Improve Backend Error Logging

**Status**: ✅ Complete
**Priority**: Medium
**Created**: 2026-01-29
**Completed**: 2026-01-30

## Context
In `backend/services/stock_service.py`, the `_calculate_batch_deltas` method iterates through a list of tickers. It currently uses a broad `try...except` block that silently catches exceptions and `continue`s to the next iteration.

```python
except Exception:
    # Skip failures for individual tickers in batch
    continue
```

This makes debugging impossible if a specific ticker fails systematically (e.g., changed API data format, invalid ticker), as no log is generated.

## Objective
Add proper error logging to the exception handler to improve observability without breaking the batch processing resilience.

## Implementation Plan

1.  **Update Service**:
    *   File: `backend/services/stock_service.py`
    *   Locate `_calculate_batch_deltas`.
    *   Modify the `except` block to log a warning using `logger.warning(f"Failed to calculate deltas for {ticker}: {e}")`.

## Verification
*   ✅ Updated `backend/services/stock_service.py` to log errors with `exc_info=True`
*   ✅ Created comprehensive test suite in `tests/test_stock_service_batch_errors.py`
*   ✅ All 3 tests pass with `caplog` verification
*   ✅ Tests verify: error logging with traceback, continuation of valid tickers, and no errors when all succeed

## Changes Made
1. Modified `_calculate_batch_deltas` exception handler to use `logger.error()` with `exc_info=True`
2. Added 3 unit tests using `caplog` fixture to verify error logging behavior
3. Updated `pyproject.toml` to ignore `dateutil` deprecation warnings from third-party libraries
