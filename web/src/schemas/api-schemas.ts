import { z } from 'zod';

/**
 * Zod schemas for runtime validation of API responses.
 * 
 * These schemas mirror the backend Pydantic models and provide runtime type safety.
 * Use these schemas to validate API responses before using the data.
 * 
 * @see backend/schemas.py - Source of truth for response models
 */

// ===========================
// Stock Schemas
// ===========================

export const StockMetricsSchema = z.object({
  last_close: z.number(),
  change: z.number(),
  pct_change: z.number(),
  high: z.number(),
  low: z.number(),
  volume: z.number(),
  volatility: z.number().nullable(),
  sharpe_ratio: z.number().nullable(),
  risk_free_rate: z.number(),
});

export const StockHistoryPointSchema = z.object({
  Datetime: z.string(),
  Open: z.number(),
  High: z.number(),
  Low: z.number(),
  Close: z.number(),
  Volume: z.number(),
});

export const StockIndicatorsPointSchema = z.object({
  Datetime: z.string(),
  SMA_20: z.number().nullable(),
  EMA_20: z.number().nullable(),
  EMA_21: z.number().nullable().optional(),
  RSI_14: z.number().nullable(),
});

export const StockFundamentalsSchema = z.object({
  ticker: z.string(),
  name: z.string().nullable(),
  market_cap: z.number().nullable(),
  trailing_pe: z.number().nullable(),
  forward_pe: z.number().nullable(),
  beta: z.number().nullable(),
  fifty_two_week_high: z.number().nullable(),
  fifty_two_week_low: z.number().nullable(),
  dividend_yield: z.number().nullable(),
  trailing_eps: z.number().nullable(),
  profit_margin: z.number().nullable(),
  price_to_sales: z.number().nullable(),
  debt_to_equity: z.number().nullable(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
});

// ===========================
// Sentiment Schemas
// ===========================

export const SentimentArticleSchema = z.object({
  title: z.string(),
  link: z.string(),
  publisher: z.string(),
  score: z.number(),
});

export const SentimentResponseSchema = z.object({
  sentiment_score: z.number(),
  sentiment_label: z.string(),
  news_count: z.number(),
  headlines: z.array(SentimentArticleSchema),
  message: z.string().nullable().optional(),
});

// ===========================
// Macro Data Schemas
// ===========================

export const MacroDataMetadataSchema = z.object({
  last_updated: z.string().nullable().optional(),
  is_stale: z.boolean().default(false),
});

export const LiquidityPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  growth_rate: z.number().nullable(),
});

export const DebtPointSchema = z.object({
  date: z.string(),
  interest_payments: z.number(),
  tax_receipts: z.number(),
  ratio: z.number(),
});

export const RealRatePointSchema = z.object({
  date: z.string(),
  treasury_yield_10y: z.number(),
  cpi_inflation: z.number(),
  real_rate: z.number(),
});

export const CPIPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export const LiquidityResponseSchema = z.object({
  data: z.array(LiquidityPointSchema),
  metadata: MacroDataMetadataSchema,
});

export const DebtStatusResponseSchema = z.object({
  data: z.array(DebtPointSchema),
  metadata: MacroDataMetadataSchema,
});

export const RealRatesResponseSchema = z.object({
  data: z.array(RealRatePointSchema),
  metadata: MacroDataMetadataSchema,
});

export const CPIResponseSchema = z.object({
  data: z.array(CPIPointSchema),
  metadata: MacroDataMetadataSchema,
});

export const MacroMetricsSchema = z.object({
  m2_supply: z.number(),
  m2_growth: z.number(),
  debt_to_tax_ratio: z.number(),
  real_rate: z.number(),
});

export const MacroSummaryResponseSchema = z.object({
  liquidity: LiquidityResponseSchema,
  debt_status: DebtStatusResponseSchema,
  real_rates: RealRatesResponseSchema,
  cpi: CPIResponseSchema,
  summary: MacroMetricsSchema,
});

// ===========================
// Macro Series Schemas (for overlay feature)
// ===========================

export const MacroSeriesPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export const MacroSeriesInfoSchema = z.object({
  series_id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  frequency: z.string(),
  units: z.string().nullable().optional(),
});

export const MacroSeriesDataSchema = z.object({
  series_id: z.string(),
  name: z.string(),
  data: z.array(MacroSeriesPointSchema),
  metadata: MacroDataMetadataSchema,
});

export const MacroSeriesResponseSchema = z.object({
  series: z.array(MacroSeriesDataSchema),
});

export const AvailableOverlaysResponseSchema = z.object({
  overlays: z.array(MacroSeriesInfoSchema),
});

// Inferred types for macro series
export type MacroSeriesPoint = z.infer<typeof MacroSeriesPointSchema>;
export type MacroSeriesInfo = z.infer<typeof MacroSeriesInfoSchema>;
export type MacroSeriesData = z.infer<typeof MacroSeriesDataSchema>;
export type MacroSeriesResponse = z.infer<typeof MacroSeriesResponseSchema>;
export type AvailableOverlaysResponse = z.infer<typeof AvailableOverlaysResponseSchema>;

// ===========================
// Crypto Schemas
// ===========================

export const CryptoPointSchema = z.object({
  timestamp: z.string(),
  total_mcap: z.number(),
  btc_dominance: z.number(),
  eth_dominance: z.number(),
  altcoin_mcap: z.number(),
});

export const CryptoDominanceResponseSchema = z.object({
  data: z.array(CryptoPointSchema),
  metadata: z.object({
    last_updated: z.string().nullable(),
    is_stale: z.boolean(),
    error: z.string().optional(),
  }),
});

// ===========================
// Risk / Regression Bands Schemas
// ===========================

export const RiskBandValueSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export const RiskBandSchema = z.object({
  level: z.number(),
  name: z.string(),
  color: z.string(),
  std_multiplier: z.number(),
  values: z.array(RiskBandValueSchema),
});

export const CurrentBandSchema = z.object({
  level: z.number(),
  name: z.string(),
  color: z.string(),
});

export const RegressionParamsSchema = z.object({
  a: z.number(),
  b: z.number(),
  std: z.number(),
});

export const RiskResponseSchema = z.object({
  ticker: z.string(),
  current_risk: z.number(),
  current_band: CurrentBandSchema,
  current_price: z.number(),
  fair_value: z.number(),
  bands: z.array(RiskBandSchema),
  regression_params: RegressionParamsSchema,
  inception_date: z.string(),
  data_points: z.number(),
});

export const RiskScoreResponseSchema = z.object({
  ticker: z.string(),
  current_risk: z.number(),
  current_band: CurrentBandSchema,
  current_price: z.number(),
  fair_value: z.number(),
});

// ===========================
// Configuration Schemas
// ===========================

export const TimeframeConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  days: z.number().nullable(),
  period: z.string(),
  interval: z.string(),
});

export const CacheConfigSchema = z.object({
  ttl_seconds: z.number(),
  stale_threshold_hours: z.number(),
});

export const ApiLimitsConfigSchema = z.object({
  fred_daily_limit: z.number(),
  coingecko_per_minute: z.number(),
});

export const ChartDefaultsConfigSchema = z.object({
  sma_window: z.number(),
  ema_window: z.number(),
  rsi_window: z.number(),
  default_ticker: z.string(),
  default_tickers: z.array(z.string()),
});

export const MarketIndexSchema = z.object({
  ticker: z.string(),
  name: z.string(),
});

export const AppConfigSchema = z.object({
  version: z.string(),
  timeframes: z.array(TimeframeConfigSchema),
  cache: CacheConfigSchema,
  api_limits: ApiLimitsConfigSchema,
  chart_defaults: ChartDefaultsConfigSchema,
  market_indices: z.array(MarketIndexSchema),
  watchlist_tickers: z.array(z.string()),
});

// ===========================
// Comparison Schemas
// ===========================

export const ComparisonPointSchema = z.object({
  date: z.string(),
  Hard_Index: z.number(),
  Soft_Index: z.number(),
  Ratio: z.number(),
  Ratio_Normalized: z.number(),
});

export const ComparisonResultSchema = z.object({
  data: z.array(ComparisonPointSchema),
});

// ===========================
// Health Check Schemas
// ===========================

export const HealthResponseSchema = z.object({
  status: z.string(),
});

// ===========================
// Type Exports (inferred from Zod schemas)
// ===========================

export type StockMetrics = z.infer<typeof StockMetricsSchema>;
export type StockHistoryPoint = z.infer<typeof StockHistoryPointSchema>;
export type StockIndicatorsPoint = z.infer<typeof StockIndicatorsPointSchema>;
export type StockFundamentals = z.infer<typeof StockFundamentalsSchema>;
export type SentimentArticle = z.infer<typeof SentimentArticleSchema>;
export type SentimentResponse = z.infer<typeof SentimentResponseSchema>;
export type LiquidityPoint = z.infer<typeof LiquidityPointSchema>;
export type DebtPoint = z.infer<typeof DebtPointSchema>;
export type RealRatePoint = z.infer<typeof RealRatePointSchema>;
export type CPIPoint = z.infer<typeof CPIPointSchema>;
export type MacroDataMetadata = z.infer<typeof MacroDataMetadataSchema>;
export type LiquidityResponse = z.infer<typeof LiquidityResponseSchema>;
export type DebtStatusResponse = z.infer<typeof DebtStatusResponseSchema>;
export type RealRatesResponse = z.infer<typeof RealRatesResponseSchema>;
export type CPIResponse = z.infer<typeof CPIResponseSchema>;
export type MacroMetrics = z.infer<typeof MacroMetricsSchema>;
export type MacroSummaryResponse = z.infer<typeof MacroSummaryResponseSchema>;
export type CryptoPoint = z.infer<typeof CryptoPointSchema>;
export type CryptoDominanceResponse = z.infer<typeof CryptoDominanceResponseSchema>;
export type RiskBandValue = z.infer<typeof RiskBandValueSchema>;
export type RiskBand = z.infer<typeof RiskBandSchema>;
export type CurrentBand = z.infer<typeof CurrentBandSchema>;
export type RegressionParams = z.infer<typeof RegressionParamsSchema>;
export type RiskResponse = z.infer<typeof RiskResponseSchema>;
export type RiskScoreResponse = z.infer<typeof RiskScoreResponseSchema>;
export type TimeframeConfig = z.infer<typeof TimeframeConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type ApiLimitsConfig = z.infer<typeof ApiLimitsConfigSchema>;
export type ChartDefaultsConfig = z.infer<typeof ChartDefaultsConfigSchema>;
export type MarketIndex = z.infer<typeof MarketIndexSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type ComparisonPoint = z.infer<typeof ComparisonPointSchema>;
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// For backward compatibility
export type SentimentResult = SentimentResponse;
