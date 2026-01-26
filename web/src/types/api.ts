/**
 * API Type Definitions
 * 
 * This file re-exports types from the Zod schemas for backward compatibility.
 * 
 * Type Sources:
 * - Primary: @/schemas/api-schemas.ts - Zod schemas with runtime validation
 * - Generated: ./api-generated.ts - Auto-generated from OpenAPI (reference only)
 * 
 * The Zod schemas in api-schemas.ts are the single source of truth for:
 * - Runtime validation in API client
 * - TypeScript type inference
 * - Data structure documentation
 * 
 * The api-generated.ts file is auto-generated from the backend OpenAPI schema
 * and serves as a reference to ensure type consistency. We don't use it directly
 * because:
 * 1. It doesn't provide runtime validation
 * 2. Nested component references make it harder to use
 * 3. Zod schemas provide better developer experience
 * 
 * Naming Convention Differences:
 * - Backend (Python): snake_case (e.g., last_updated)
 * - Frontend (TypeScript): Matches backend exactly for API types
 * - This is intentional to maintain 1:1 mapping with API responses
 */

export * from '@/schemas/api-schemas';

