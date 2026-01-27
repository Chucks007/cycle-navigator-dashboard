# Task 003: Consolidate Data Ingestion Logic

**Status**: ✅ Completed
**Priority**: Medium
**Created**: 2026-01-26
**Completed**: 2026-01-27

## Context
There is significant code duplication between the background tasks (Celery) and the initialization/sync scripts:
- `backend/tasks/fred_tasks.py`: Contains logic to store FRED data in DB and cache in Redis.
- `backend/services/macro.py`: `fetch_all_fred_series_sync` repeats almost identical logic for storage and caching.
- `backend/services/crypto.py`: `fetch_crypto_dominance_sync` repeats logic found in (presumed) crypto background tasks.

## Objective
Extract the "Store and Cache" logic into shared service methods or utilities that can be called by both Celery tasks and synchronous initialization scripts.

## Implementation Plan

### 1. Create Ingestion Utilities
- In `backend/services/macro.py`, create a method `update_series_data(series_id, data)` that handles both DB storage and Redis caching.
- In `backend/services/crypto.py`, create a similar method for crypto data.

### 2. Update Celery Tasks
- Refactor `backend/tasks/fred_tasks.py` to use the new service methods instead of having its own `store_series_in_db` and `cache_series_in_redis`.

### 3. Update Sync Methods
- Refactor `fetch_all_fred_series_sync` and `fetch_crypto_dominance_sync` to use these same unified methods.

## Benefits
- **Single Source of Truth**: Changes to how data is stored or cached only need to be made in one place.
- **Dry Code**: Eliminates large blocks of nearly identical code across tasks and services.
- **Reliability**: Reduces the risk of "drift" where the background task behaves differently than the manual sync script.
