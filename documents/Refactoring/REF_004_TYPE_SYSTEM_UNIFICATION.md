# Refactor 004: Type System Unification

## Objective
Streamline the frontend type system by removing the intermediate `web/src/types/api.ts` layer and using `web/src/schemas/api-types.ts` as the unified source of truth.

## Current Issues
- `web/src/types/api.ts` is just a pass-through re-export.
- Devs have to check two locations to understand data structures.
- Inconsistent usage between importing `type { ... }` from `api.ts` vs `api-schemas.ts`.

## Implementation Plan
1. [x] Search for all imports from `@/types/api`.
2. [x] Replace them with imports from `@/schemas/api-types`.
3. [x] Ensure all necessary types are exported via `z.infer` in `api-types.ts`.
4. [x] Delete `web/src/types/api.ts`.
5. [x] Rename `api-schemas.ts` → `api-types.ts` for clarity.

## Acceptance Criteria
1. Single source of truth for API data structures.
2. No unnecessary re-export files.
3. TypeScript build passes.
