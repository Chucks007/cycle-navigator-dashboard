# Task 019: Backend Service Architecture Refactoring

## Objective
Standardize the backend service architecture by consolidating all business logic into the `backend/services/` directory and eliminating redundant wrapper files in the root `backend/` directory.

## Current Issues
The current codebase has a mix of service patterns:
1. **Misplaced Implementation:** `backend/comparison_service.py` contains core logic but resides in the root.
2. **Redundant Wrappers:** `backend/macro_service.py` and `backend/sentiment_service.py` exist only to re-export functionality from `backend/services/`.
3. **Inconsistent Imports:** Routers and tests import from different locations (root wrappers vs. `services/` modules).

## Proposed Structure
All service implementations should reside strictly within `backend/services/`.

```
backend/
├── routers/              # HTTP layer
├── services/             # Business logic layer
│   ├── __init__.py
│   ├── common.py
│   ├── comparison.py     # Moved from backend/comparison_service.py
│   ├── crypto.py
│   ├── macro.py
│   ├── risk.py
│   ├── sentiment.py
│   └── stock_service.py
└── ...
```

## Implementation Plan

### Phase 1: Comparison Service Migration
- [ ] Move `backend/comparison_service.py` to `backend/services/comparison.py`.
- [ ] Update internal imports in `backend/services/comparison.py` to resolve dependencies (e.g., `from .utils` -> `from ..utils` or specific service imports).
- [ ] Update `backend/routers/comparison.py` to import from `backend.services.comparison`.
- [ ] Update `tests/test_comparison_service.py` to import from `backend.services.comparison`.

### Phase 2: Macro Service Cleanup
- [ ] Search for all references to `backend.macro_service`.
- [ ] Update references to point to `backend.services.macro`.
- [ ] Verify `tests/test_macro_service.py` imports.
- [ ] Delete `backend/macro_service.py`.

### Phase 3: Sentiment Service Cleanup
- [ ] Search for all references to `backend.sentiment_service`.
- [ ] Update references to point to `backend.services.sentiment`.
- [ ] Verify `tests/test_services.py` imports.
- [ ] Delete `backend/sentiment_service.py`.

### Phase 4: Verification
- [ ] Run full test suite: `pytest`
- [ ] Verify backend startup: `uvicorn backend.main:app --reload`
- [ ] Check `backend/services/__init__.py` exposes necessary services cleanly.

## Acceptance Criteria
1. No `*_service.py` files remain in `backend/` root.
2. All services reside in `backend/services/`.
3. All tests pass without `ImportError`.
4. API endpoints continue to function identically.
