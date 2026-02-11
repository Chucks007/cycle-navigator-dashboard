# Refactor 002: Backend Utility Cleanup [COMPLETE]

## Objective
Standardize backend utility management by separating high-level API decorators from low-level library wrappers.

## Current Issues
- `backend/utils.py` contains both the `handle_api_errors` decorator and `yfinance` stubbing logic.
- `yfinance` logic is library-specific and should be encapsulated.
- Router-specific decorators are mixed with general utilities.

## Proposed Structure
- `backend/routers/utils.py`: Move `handle_api_errors` here.
- `backend/services/common.py` or `backend/lib/yf_wrapper.py`: Move `yfinance` stubbing and wrapper logic here.
- `backend/utils.py`: Should only contain general-purpose, non-domain-specific utilities (if any remain).

## Implementation Plan
1. [x] Move `handle_api_errors` to `backend/routers/utils.py`.
2. [x] Update all router files to import the decorator from the new location.
3. [x] Create `backend/services/common.py` (if it doesn't exist) or `backend/lib/yf_wrapper.py`.
4. [x] Move `get_yf` and the stubbing logic to the new location.
5. [x] Update `backend/services/stock_service.py` and others to use the new `yf` wrapper.
6. [x] Verify backend tests pass.

## Acceptance Criteria
1. `backend/utils.py` does not contain router-specific logic.
2. `yfinance` integration is cleanly encapsulated.
3. API endpoints function identically.
