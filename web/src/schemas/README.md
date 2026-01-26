# API Schemas

This directory contains Zod schemas for runtime validation of API responses.

## Purpose

These schemas serve three critical functions:

1. **Runtime Validation**: Validate API responses match expected structure
2. **Type Generation**: TypeScript types are inferred from schemas
3. **Documentation**: Self-documenting with validation rules

## Usage

### Importing Types

```typescript
// Import both schema and type
import { StockMetrics, StockMetricsSchema } from '@/schemas/api-schemas';

// Use type for annotations
const metrics: StockMetrics = await apiClient.getStockMetrics('AAPL');

// Use schema for validation (done automatically in API client)
const validated = StockMetricsSchema.parse(unknownData);
```

### Adding New Schemas

When adding a new API endpoint:

1. **Check OpenAPI schema**: Run `npm run generate:api` to see backend types
2. **Create Zod schema** in `api-schemas.ts`:

```typescript
export const NewFeatureSchema = z.object({
  id: z.string(),
  value: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

export type NewFeature = z.infer<typeof NewFeatureSchema>;
```

3. **Add to API client** in `lib/api-client.ts`:

```typescript
public async getNewFeature(): Promise<NewFeature> {
  return this.validatedRequest('/api/new-feature', NewFeatureSchema);
}
```

4. **Verify**: Run `npm run typecheck` to ensure no errors

## Files

- **api-schemas.ts**: All Zod schemas and inferred types
- **index.ts**: Re-exports for convenient imports

## Validation

All API responses are automatically validated in the API client:

```typescript
// Happens automatically
const data = await apiClient.getStockMetrics('AAPL');
// ✅ If valid: returns typed data
// ❌ If invalid: throws error with details
```

## Error Handling

When validation fails, you'll see:

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

## Documentation

See [TYPE_SYSTEM.md](../../documents/TYPE_SYSTEM.md) for comprehensive documentation.

## Best Practices

- ✅ Keep schemas in sync with backend Pydantic models
- ✅ Use `.nullable()` for fields that can be null
- ✅ Use `.optional()` for fields that may not exist
- ✅ Match backend naming (snake_case for API types)
- ✅ Run `npm run typecheck` before committing
- ❌ Don't modify auto-generated `api-generated.ts`
- ❌ Don't skip validation for performance
