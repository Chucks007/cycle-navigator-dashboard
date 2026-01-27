# Task 004: Refactor Monolithic Startup Validation

**Status**: Pending
**Priority**: Low
**Created**: 2026-01-26

## Context
The `startup_event` in `backend/main.py` is a monolithic function (~100 lines) that handles:
1. Environment variable validation.
2. Database connectivity checks.
3. Redis connectivity checks.
4. Database schema/table validation.

This makes `main.py` cluttered and makes it harder to reuse these health checks for other purposes (like the `/health/detailed` endpoint, which *also* duplicates some of this logic).

## Objective
Extract startup validation into a dedicated module and unify it with health check logic.

## Implementation Plan

### 1. Create `backend/health.py`
- Move all validation logic into a `HealthCheckService` or a set of validation functions.
- Create specific functions for `check_database()`, `check_redis()`, `check_schema()`, etc.

### 2. Unify Health Endpoints
- Refactor `backend/main.py` to call these centralized health check functions in both the `startup_event` and the `/health/detailed` endpoint.

### 3. Cleanup `main.py`
- `main.py` should only contain the high-level orchestration of the app, not the implementation details of every health check.

## Benefits
- **Clean Main Module**: Reduces the size and complexity of the application entry point.
- **Reusability**: Shared validation logic between startup and health endpoints.
- **Testability**: Individual health checks can be unit tested in isolation.
