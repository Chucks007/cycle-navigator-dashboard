# Type System Quick Reference

## Import Patterns

```typescript
// Recommended: Import from schemas (includes validation)
import { StockMetrics, StockMetricsSchema } from '@/schemas/api-schemas';

// Alternative: Import from types (backward compatible)
import { StockMetrics } from '@/types/api';

// For validation only
import { StockMetricsSchema } from '@/schemas/api-schemas';
```

## Common Schemas

### Stock
- `StockMetricsSchema` / `StockMetrics`
- `StockHistoryPointSchema` / `StockHistoryPoint`
- `StockIndicatorsPointSchema` / `StockIndicatorsPoint`

### Macro
- `LiquidityResponseSchema` / `LiquidityResponse`
- `DebtStatusResponseSchema` / `DebtStatusResponse`
- `RealRatesResponseSchema` / `RealRatesResponse`
- `CPIResponseSchema` / `CPIResponse`
- `MacroSummaryResponseSchema` / `MacroSummaryResponse`

### Crypto
- `CryptoDominanceResponseSchema` / `CryptoDominanceResponse`

### Risk
- `RiskResponseSchema` / `RiskResponse`
- `RiskScoreResponseSchema` / `RiskScoreResponse`

### Config
- `AppConfigSchema` / `AppConfig`

## NPM Scripts

```bash
# Type check
npm run typecheck

# Type check + lint
npm run validate

# Generate OpenAPI types
npm run generate:api

# Build (includes type generation)
npm run build
```

## Manual Validation

```typescript
import { StockMetricsSchema } from '@/schemas/api-schemas';

// Parse and validate
const validated = StockMetricsSchema.parse(data);

// Safe parse (no throw)
const result = StockMetricsSchema.safeParse(data);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.issues);
}
```

## Type System Layers

1. **Zod Schemas** - Runtime validation + type inference
2. **TypeScript Types** - Compile-time checking
3. **OpenAPI Types** - Backend contract reference

## Files

- `web/src/schemas/api-schemas.ts` - Primary source
- `web/src/types/api.ts` - Re-exports schemas
- `web/src/types/api-generated.ts` - Auto-generated (reference)
- `web/src/lib/api-client.ts` - Automatic validation
- `documents/TYPE_SYSTEM.md` - Full documentation
