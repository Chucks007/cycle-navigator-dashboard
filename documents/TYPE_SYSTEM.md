# Type System Documentation

This document explains the type system architecture for the Cycle Navigator Dashboard.

## Overview

The frontend uses a **three-layer type system** to ensure type safety at both compile-time and runtime:

1. **Zod Schemas** (`web/src/schemas/api-schemas.ts`) - Single source of truth
2. **TypeScript Types** (`web/src/types/api.ts`) - Re-exported from schemas
3. **OpenAPI Generated Types** (`web/src/types/api-generated.ts`) - Reference only

## Architecture

### Layer 1: Zod Schemas (Primary)

**Location**: `web/src/schemas/api-schemas.ts`

**Purpose**: Runtime validation and type inference

```typescript
export const StockMetricsSchema = z.object({
  last_close: z.number(),
  change: z.number(),
  pct_change: z.number(),
  // ... more fields
});

export type StockMetrics = z.infer<typeof StockMetricsSchema>;
```

**Benefits**:
- ✅ Runtime validation catches API contract violations
- ✅ Single source of truth for both types and validation
- ✅ Excellent TypeScript inference
- ✅ Self-documenting with validation rules
- ✅ Prevents invalid data from propagating through the app

**Usage**: All API client methods use these schemas for validation:

```typescript
public async getStockMetrics(ticker: string): Promise<StockMetrics> {
  return this.validatedRequest(`/api/stock/${ticker}`, StockMetricsSchema);
}
```

### Layer 2: TypeScript Types (Convenience)

**Location**: `web/src/types/api.ts`

**Purpose**: Backward compatibility and cleaner imports

```typescript
export * from '@/schemas/api-schemas';
```

This file simply re-exports all types from the Zod schemas. Components can import from either location:

```typescript
// Both are equivalent:
import { StockMetrics } from '@/types/api';
import { StockMetrics } from '@/schemas/api-schemas';
```

### Layer 3: OpenAPI Generated (Reference)

**Location**: `web/src/types/api-generated.ts`

**Purpose**: Verification and documentation only

This file is **auto-generated** from the backend's OpenAPI schema:

```bash
npm run generate:api
# Generates from: http://localhost:8000/openapi.json
```

**Why we don't use it directly**:
- ❌ No runtime validation
- ❌ Complex nested structure (`components["schemas"]["TypeName"]`)
- ❌ Less developer-friendly
- ✅ But excellent for verifying our schemas match backend

**Usage**: Reference only. Check this when updating schemas to ensure they match the backend.

## Data Flow

```
Backend (Pydantic) → OpenAPI Schema → api-generated.ts (reference)
                                    ↓
                            Zod Schemas (api-schemas.ts)
                                    ↓
                            TypeScript Types (api.ts)
                                    ↓
                            API Client (validated requests)
                                    ↓
                            React Components (type-safe)
```

## Naming Conventions

### Snake Case (API Responses)

The frontend **intentionally uses snake_case** for API response types to maintain a 1:1 mapping with the backend:

```typescript
interface StockMetrics {
  last_close: number;      // ✅ Matches backend exactly
  pct_change: number;      // ✅ Matches backend exactly
  risk_free_rate: number;  // ✅ Matches backend exactly
}
```

**Why?**
- Direct mapping to API responses (no transformation needed)
- Easier debugging (same field names in network tab and code)
- Matches Python/Pydantic conventions from backend

### Camel Case (React Components)

React props and component state use camelCase:

```typescript
interface ChartProps {
  showLegend: boolean;    // ✅ React convention
  timeframe: string;      // ✅ Component-specific
  onUpdate: () => void;   // ✅ Event handlers
}
```

## Validation Process

### 1. API Client Validation

All API responses are validated automatically in `api-client.ts`:

```typescript
private async validatedRequest<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  options?: RequestInit
): Promise<T> {
  const data = await this.request<unknown>(endpoint, options);
  
  try {
    return schema.parse(data);  // ✅ Throws if invalid
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('API response validation failed:', {
        endpoint,
        errors: error.errors,
        data,
      });
      throw new Error(`Invalid API response: ${error.message}`);
    }
    throw error;
  }
}
```

### 2. Error Handling

When validation fails:

1. **Console error** logs the validation errors and actual data
2. **Error thrown** with descriptive message
3. **UI components** catch via error boundaries or React Query error handling

Example error output:

```
API response validation failed: {
  endpoint: "/api/stock/AAPL",
  errors: [
    {
      path: ["volatility"],
      message: "Expected number, received string"
    }
  ],
  data: { ... }
}
```

## Type Checking

### Pre-commit Checks

```bash
# Type check only (fast)
npm run typecheck

# Full validation (types + lint)
npm run validate

# Auto-generate API types before build
npm run build  # Runs prebuild hook
```

### CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Type check
  run: npm run typecheck

- name: Lint
  run: npm run lint
```

## Adding New API Types

### Step 1: Update Backend

Add Pydantic model in `backend/schemas.py`:

```python
class NewFeatureResponse(BaseModel):
    feature_id: str
    value: float
    metadata: dict
```

### Step 2: Create Zod Schema

Add to `web/src/schemas/api-schemas.ts`:

```typescript
export const NewFeatureResponseSchema = z.object({
  feature_id: z.string(),
  value: z.number(),
  metadata: z.record(z.unknown()),
});

export type NewFeatureResponse = z.infer<typeof NewFeatureResponseSchema>;
```

### Step 3: Add API Client Method

Update `web/src/lib/api-client.ts`:

```typescript
public async getNewFeature(): Promise<NewFeatureResponse> {
  return this.validatedRequest('/api/new-feature', NewFeatureResponseSchema);
}
```

### Step 4: Verify Against OpenAPI

```bash
npm run generate:api
```

Check `api-generated.ts` to ensure your schema matches the backend.

## Best Practices

### ✅ DO

- Use Zod schemas for all API response types
- Keep schemas in sync with backend Pydantic models
- Run `npm run typecheck` before committing
- Regenerate `api-generated.ts` when backend changes
- Use snake_case for API types (matches backend)
- Add `.nullable()` for fields that can be null
- Add `.optional()` for fields that may not exist

### ❌ DON'T

- Import directly from `api-generated.ts` in components
- Mix camelCase/snake_case in API response types
- Skip validation for "performance" (use validated requests)
- Create duplicate type definitions
- Modify `api-generated.ts` manually (it's auto-generated)

## Debugging Type Issues

### Issue: "Type does not match schema"

**Cause**: Backend changed but frontend schema not updated

**Solution**:
1. Check `api-generated.ts` for latest backend types
2. Update Zod schema in `api-schemas.ts`
3. Run `npm run typecheck`

### Issue: "Validation failed at runtime"

**Cause**: Backend returned unexpected data structure

**Solution**:
1. Check console for validation errors (shows exact field mismatch)
2. Verify backend endpoint is correct version
3. Check if backend is returning cached data with old structure
4. Update schema if backend intentionally changed

### Issue: "Cannot find module '@/schemas/api-schemas'"

**Cause**: Import path issue

**Solution**:
```typescript
// Use path alias (preferred)
import { StockMetrics } from '@/schemas/api-schemas';

// Or relative path
import { StockMetrics } from '../schemas/api-schemas';
```

## Migration Guide

If you have existing code importing from old `types/api.ts`, no changes needed! The file now re-exports from schemas:

```typescript
// Old code - still works! ✅
import { StockMetrics } from '@/types/api';

// New code - recommended ✅
import { StockMetrics, StockMetricsSchema } from '@/schemas/api-schemas';
```

## Testing

### Unit Testing Schemas

```typescript
import { describe, it, expect } from 'vitest';
import { StockMetricsSchema } from '@/schemas/api-schemas';

describe('StockMetricsSchema', () => {
  it('validates correct data', () => {
    const validData = {
      last_close: 150.25,
      change: 2.50,
      pct_change: 1.69,
      high: 151.00,
      low: 149.50,
      volume: 1000000,
      volatility: 0.15,
      sharpe_ratio: 1.2,
      risk_free_rate: 0.05,
    };

    expect(() => StockMetricsSchema.parse(validData)).not.toThrow();
  });

  it('rejects invalid data', () => {
    const invalidData = {
      last_close: "not a number",  // ❌ Wrong type
      // ... missing required fields
    };

    expect(() => StockMetricsSchema.parse(invalidData)).toThrow();
  });
});
```

## References

- [Zod Documentation](https://zod.dev)
- [OpenAPI TypeScript Generator](https://www.npmjs.com/package/openapi-typescript)
- Backend API Schema: http://localhost:8000/docs
- Backend OpenAPI JSON: http://localhost:8000/openapi.json
