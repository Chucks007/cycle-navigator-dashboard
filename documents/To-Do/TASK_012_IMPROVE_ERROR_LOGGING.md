# Task 012: Improve Backend Error Logging

**Status**: Pending
**Priority**: Medium
**Created**: 2026-01-29

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
*   Run the backend.
*   Trigger a batch fetch with an invalid ticker (if possible) or simulate an error.
*   Check `backend.log` (or console output) to ensure the warning appears.
