# Refactor 001: Split Frontend API Hooks [COMPLETE]

## Objective
Decompose the monolithic `web/src/hooks/use-data.ts` into feature-specific hook files to improve maintainability, reduce file size, and clarify dependencies.

## Current Issues
- `use-data.ts` is ~200 lines and growing.
- It mixes concerns: Macro data, Stock data, Crypto data, and Sentiment.
- Difficult to navigate as more indicators are added.

## Proposed Structure
New files in `web/src/hooks/`:
- `use-macro-data.ts`: All macro-related hooks (`useLiquidity`, `useCpi`, etc.)
- `use-stock-data.ts`: All stock-related hooks (`useStockMetrics`, `useStockHistory`, etc.)
- `use-crypto-data.ts`: All crypto-related hooks (`useCryptoDominance`)
- `use-risk-data.ts`: All risk-related hooks (`useRiskData`, `useRiskScore`)
- `use-sentiment-data.ts`: All sentiment-related hooks (`useSentiment`)

## Implementation Plan
1. [x] Create the new hook files in `web/src/hooks/`.
2. [x] Move the respective hooks from `use-data.ts` to their new homes.
3. [x] Update imports in all consuming components:
    - `web/src/app/page.tsx`
    - `web/src/app/ticker/page.tsx`
    - `web/src/components/features/macro/`
    - `web/src/components/features/ticker/`
4. [x] Delete `web/src/hooks/use-data.ts` once empty.
5. [x] Verify application build and functionality.

## Acceptance Criteria
1. `use-data.ts` no longer exists.
2. Every hook is imported from a file that matches its feature domain.
3. No circular dependencies introduced.
