export interface StockMetrics {
  last_close: number;
  change: number;
  pct_change: number;
  high: number;
  low: number;
  volume: number;
  volatility: number | null;
  sharpe_ratio: number | null;
  risk_free_rate: number;
}

export interface StockHistoryPoint {
  Datetime: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

export interface StockIndicatorsPoint {
  Datetime: string;
  SMA_20: number | null;
  EMA_20: number | null;
  RSI_14: number | null;
}

export interface SentimentArticle {
  title: string;
  link: string;
  publisher: string;
  score: number;
}

export interface SentimentResponse {
  sentiment_score: number;
  sentiment_label: string;
  news_count: number;
  headlines: SentimentArticle[];
  message: string | null;
}

// Alias for simpler usage if desired, matching prompt mention of SentimentResult
export type SentimentResult = SentimentResponse;

export interface LiquidityPoint {
  date: string;
  value: number;
  growth_rate: number | null;
}

export interface DebtPoint {
  date: string;
  interest_payments: number;
  tax_receipts: number;
  ratio: number;
}

export interface RealRatePoint {
  date: string;
  treasury_yield_10y: number;
  cpi_inflation: number;
  real_rate: number;
}

export interface CPIPoint {
  date: string;
  value: number;
}

export interface CryptoPoint {
  timestamp: string;
  total_mcap: number;
  btc_dominance: number;
  eth_dominance: number;
  altcoin_mcap: number;
}

export interface CryptoDominanceResponse {
  data: CryptoPoint[];
  metadata: {
    last_updated: string | null;
    is_stale: boolean;
    error?: string;
  };
}

export interface MacroMetrics {
  m2_supply: number;
  m2_growth: number;
  debt_to_tax_ratio: number;
  real_rate: number;
}

export interface MacroDataMetadata {
  last_updated: string | null;
  is_stale: boolean;
}

export interface LiquidityResponse {
  data: LiquidityPoint[];
  metadata: MacroDataMetadata;
}

export interface DebtStatusResponse {
  data: DebtPoint[];
  metadata: MacroDataMetadata;
}

export interface RealRatesResponse {
  data: RealRatePoint[];
  metadata: MacroDataMetadata;
}

export interface CPIResponse {
  data: CPIPoint[];
  metadata: MacroDataMetadata;
}

export interface MacroSummaryResponse {
  liquidity: LiquidityResponse;
  debt_status: DebtStatusResponse;
  real_rates: RealRatesResponse;
  cpi: CPIResponse;
  summary: MacroMetrics;
}

export interface ComparisonPoint {
  date: string;
  Hard_Index: number;
  Soft_Index: number;
  Ratio: number;
  Ratio_Normalized: number;
}

export interface ComparisonResult {
  data: ComparisonPoint[];
}

// Risk / Regression Bands

export interface RiskBandValue {
  date: string;
  value: number;
}

export interface RiskBand {
  level: number;
  name: string;
  color: string;
  std_multiplier: number;
  values: RiskBandValue[];
}

export interface CurrentBand {
  level: number;
  name: string;
  color: string;
}

export interface RegressionParams {
  a: number;
  b: number;
  std: number;
}

export interface RiskResponse {
  ticker: string;
  current_risk: number;
  current_band: CurrentBand;
  current_price: number;
  fair_value: number;
  bands: RiskBand[];
  regression_params: RegressionParams;
  inception_date: string;
  data_points: number;
}

export interface RiskScoreResponse {
  ticker: string;
  current_risk: number;
  current_band: CurrentBand;
  current_price: number;
  fair_value: number;
}
