# Task 008: Centralize API Routes

**Status**: Completed
**Priority**: Low
**Created**: 2026-01-26
**Completed**: 2026-01-27

## Context
The frontend `web/src/lib/api-client.ts` and potentially some hooks/components contain hardcoded string paths for API endpoints (e.g., `/api/macro/liquidity`, `/api/stocks/ticker`).

If the backend API version changes or routes are renamed, these hardcoded strings will break and be hard to find.

## Objective
Centralize all API route definitions into a single configuration file.

## Implementation Plan

### 1. Create Route Config
Create `web/src/lib/routes.ts` (or `endpoints.ts`).
- Export a constant object structure matching the API domain.
  ```typescript
  export const API_ROUTES = {
    MACRO: {
      SUMMARY: '/api/macro/summary',
      LIQUIDITY: '/api/macro/liquidity',
      ...
    },
    STOCKS: {
      TICKER: (symbol: string) => `/api/stocks/${symbol}`,
      ...
    }
  }
  ```

### 2. Update Client
Refactor `web/src/lib/api-client.ts` to use `API_ROUTES`.

## Benefits
- **Type Safety**: IDEs can autocomplete routes.
- **Maintainability**: Changing a route happens in one file.
