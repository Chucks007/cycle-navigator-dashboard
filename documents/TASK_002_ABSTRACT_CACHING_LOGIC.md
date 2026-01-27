# Task 002: Abstract Redis/DB Fallback Logic in CachedDataService

**Status**: Pending
**Priority**: Medium
**Created**: 2026-01-26

## Context
Multiple services (`MacroService`, `CryptoService`) repeat the same pattern for fetching data:
1. Try fetching from Redis.
2. If not found, fetch from PostgreSQL.
3. Check if the fetched data is stale.
4. Return data + metadata.

Currently, this is implemented manually in each service method (e.g., `_get_series` in `MacroService`, `get_dominance` in `CryptoService`), leading to boilerplate and potential inconsistencies in how staleness or errors are handled.

## Objective
Abstract the core "fetch-with-fallback" logic into the `CachedDataService` base class to reduce duplication and improve maintainability.

## Implementation Plan

### 1. Enhance `CachedDataService`
Update `backend/services/common.py`:
- Refine `_get_with_fallback` or create a more comprehensive `fetch_data_with_metadata` method.
- This method should handle JSON parsing for Redis and formatting for the final response.

### 2. Refactor `MacroService`
Update `backend/services/macro.py`:
- Remove redundant `_get_series` logic.
- Use the base class method to fetch series data.

### 3. Refactor `CryptoService`
Update `backend/services/crypto.py`:
- Replace the manual Redis/DB check in `get_dominance` with the base class method.

### 4. Verification
- Ensure `MacroService` tests pass.
- Ensure `CryptoService` (if tests exist) passes.
- Verify API responses for `/api/macro/...` and `/api/crypto/...` maintain the same structure.

## Benefits
- **Reduced Boilerplate**: Removes ~50-100 lines of repetitive code across services.
- **Consistency**: Ensures every cached service handles staleness and fallback logic identically.
- **Maintainability**: Centralizes the caching strategy in one file.
