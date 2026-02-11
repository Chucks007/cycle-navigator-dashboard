# Refactor 004: Type System Unification

## Objective
Streamline the frontend type system by removing the intermediate `web/src/types/api.ts` layer and using `web/src/schemas/api-schemas.ts` as the unified source of truth.

## Current Issues
- `web/src/types/api.ts` is just a pass-through re-export.
- Devs have to check two locations to understand data structures.
- Inconsistent usage between importing `type { ... }` from `api.ts` vs `api-schemas.ts`.

## Implementation Plan
1. [ ] Search for all imports from `@/types/api`.
2. [ ] Replace them with imports from `@/schemas/api-schemas`.
3. [ ] Ensure all necessary types are exported via `z.infer` in `api-schemas.ts`.
4. [ ] Delete `web/src/types/api.ts`.
5. [ ] Rename `api-schemas.ts` to something more encompassing like `api-types.ts` if it helps clarity (optional).

## Acceptance Criteria
1. Single source of truth for API data structures.
2. No unnecessary re-export files.
3. TypeScript build passes.
