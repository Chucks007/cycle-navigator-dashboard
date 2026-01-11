/**
 * API utilities for communicating with the FastAPI backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ============================================
// Stock API
// ============================================

export interface StockMetrics {
  last_close: number;
  change: number;
  pct_change: number;
  high: number;
  low: number;
  volume: number;
  volatility: number;
  sharpe_ratio: number;
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

export interface StockIndicators {
  Datetime: string;
  SMA_20: number;
  EMA_20: number;
  RSI_14: number;
}

export async function fetchStockMetrics(
  ticker: string,
  period: string = '1d',
  interval: string = '1m'
): Promise<StockMetrics> {
  return apiFetch(`/api/stock/${ticker}?period=${period}&interval=${interval}`);
}

export async function fetchStockHistory(
  ticker: string,
  period: string = '1d',
  interval: string = '1m'
): Promise<StockHistoryPoint[]> {
  return apiFetch(`/api/stock/${ticker}/history?period=${period}&interval=${interval}`);
}

export async function fetchStockIndicators(
  ticker: string,
  period: string = '1d',
  interval: string = '1m'
): Promise<StockIndicators[]> {
  return apiFetch(`/api/stock/${ticker}/indicators?period=${period}&interval=${interval}`);
}

// ============================================
// Sentiment API
// ============================================

export interface SentimentHeadline {
  title: string;
  link: string;
  publisher: string;
  score: number;
}

export interface SentimentData {
  sentiment_score: number;
  sentiment_label: string;
  news_count: number;
  headlines: SentimentHeadline[];
  message?: string;
}

export async function fetchSentiment(ticker: string): Promise<SentimentData> {
  return apiFetch(`/api/sentiment/${ticker}`);
}

// ============================================
// Macro API
// ============================================

export interface LiquidityData {
  date: string;
  value: number;
  growth_rate: number;
}

export interface DebtStatusData {
  date: string;
  interest_payments: number;
  tax_receipts: number;
  ratio: number;
}

export interface RealRatesData {
  date: string;
  treasury_yield: number;
  cpi_rate: number;
  real_rate: number;
}

export async function fetchLiquidity(): Promise<LiquidityData[]> {
  return apiFetch('/api/macro/liquidity');
}

export async function fetchDebtStatus(): Promise<DebtStatusData[]> {
  return apiFetch('/api/macro/debt-status');
}

export async function fetchRealRates(): Promise<RealRatesData[]> {
  return apiFetch('/api/macro/real-rates');
}

// ============================================
// Health Check
// ============================================

export async function checkHealth(): Promise<{ status: string }> {
  return apiFetch('/health');
}
