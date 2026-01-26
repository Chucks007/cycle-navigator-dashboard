import { z } from 'zod';
import {
  StockMetrics,
  StockHistoryPoint,
  StockIndicatorsPoint,
  SentimentResponse,
  LiquidityPoint,
  DebtPoint,
  RealRatePoint,
  CPIPoint,
  CryptoDominanceResponse,
  RiskResponse,
  RiskScoreResponse,
  MacroSummaryResponse,
  AppConfig,
  StockMetricsSchema,
  StockHistoryPointSchema,
  StockIndicatorsPointSchema,
  SentimentResponseSchema,
  LiquidityResponseSchema,
  DebtStatusResponseSchema,
  RealRatesResponseSchema,
  CPIResponseSchema,
  MacroSummaryResponseSchema,
  CryptoDominanceResponseSchema,
  RiskResponseSchema,
  RiskScoreResponseSchema,
  AppConfigSchema,
  HealthResponseSchema,
} from '@/schemas/api-schemas';

// Use relative path for browser requests (proxied by Next.js rewrites)
// Only use absolute URL for server-side or when explicitly set for external access
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = API_BASE_URL;
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      // Check if it's a network error
      if (error instanceof TypeError && (error.message === 'fetch failed' || error.message.includes('Network request failed'))) {
        console.error('Backend Offline:', error);
        // Dispatch a custom event that UI components can listen to
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('api-error', {
            detail: { message: 'Backend seems to be offline. Please try again later.' }
          }));
        }
        throw new Error('Backend Offline');
      }
      throw error;
    }
  }

  /**
   * Validated request with Zod schema for runtime type safety.
   * Throws an error if the response doesn't match the expected schema.
   */
  private async validatedRequest<T>(
    endpoint: string,
    schema: z.ZodType<T>,
    options?: RequestInit
  ): Promise<T> {
    const data = await this.request<unknown>(endpoint, options);
    
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('API response validation failed:', {
          endpoint,
          errors: error.issues,
          data,
        });
        throw new Error(`Invalid API response from ${endpoint}: ${error.issues.map((e) => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  // Stock
  public async getStockMetrics(ticker: string, period: string = '1d', interval: string = '1m'): Promise<StockMetrics> {
    const query = new URLSearchParams({ period, interval });
    return this.validatedRequest(`/api/stock/${ticker}?${query.toString()}`, StockMetricsSchema);
  }

  public async getStockHistory(ticker: string, period: string = '1d', interval: string = '1m'): Promise<StockHistoryPoint[]> {
    const query = new URLSearchParams({ period, interval });
    return this.validatedRequest(`/api/stock/${ticker}/history?${query.toString()}`, z.array(StockHistoryPointSchema));
  }

  public async getStockIndicators(ticker: string, period: string = '1d', interval: string = '1m'): Promise<StockIndicatorsPoint[]> {
    const query = new URLSearchParams({ period, interval });
    return this.validatedRequest(`/api/stock/${ticker}/indicators?${query.toString()}`, z.array(StockIndicatorsPointSchema));
  }

  // Sentiment
  public async getSentiment(ticker: string): Promise<SentimentResponse> {
    return this.validatedRequest(`/api/sentiment/${ticker}`, SentimentResponseSchema);
  }

  // Macro - Backend returns {data: [...], metadata: {...}}, we extract the data array
  public async getLiquidity(days?: number): Promise<LiquidityPoint[]> {
    const query = days ? `?days=${days}` : '';
    const response = await this.validatedRequest(`/api/macro/liquidity${query}`, LiquidityResponseSchema);
    return response.data || [];
  }

  public async getDebtStatus(days?: number): Promise<DebtPoint[]> {
    const query = days ? `?days=${days}` : '';
    const response = await this.validatedRequest(`/api/macro/debt-status${query}`, DebtStatusResponseSchema);
    return response.data || [];
  }

  public async getRealRates(): Promise<RealRatePoint[]> {
    const response = await this.validatedRequest('/api/macro/real-rates', RealRatesResponseSchema);
    return response.data || [];
  }

  public async getCpi(days?: number): Promise<CPIPoint[]> {
    const query = days ? `?days=${days}` : '';
    const response = await this.validatedRequest(`/api/macro/cpi${query}`, CPIResponseSchema);
    return response.data || [];
  }

  /**
   * Fetch all macro data in a single request (optimized for dashboards).
   * Returns liquidity, debt status, real rates, CPI, and summary metrics.
   */
  public async getMacroSummary(days?: number): Promise<MacroSummaryResponse> {
    const query = days ? `?days=${days}` : '';
    return this.validatedRequest(`/api/macro/summary${query}`, MacroSummaryResponseSchema);
  }

  // Crypto
  public async getCryptoDominance(days: number = 365): Promise<CryptoDominanceResponse> {
    const query = `?days=${days}`;
    return this.validatedRequest(`/api/crypto/dominance${query}`, CryptoDominanceResponseSchema);
  }

  // Risk / Regression Bands
  public async getRiskData(ticker: string): Promise<RiskResponse> {
    return this.validatedRequest(`/api/v1/risk/${ticker}`, RiskResponseSchema);
  }

  public async getRiskScore(ticker: string): Promise<RiskScoreResponse> {
    return this.validatedRequest(`/api/v1/risk/${ticker}/score`, RiskScoreResponseSchema);
  }

  // Health
  public async checkHealth(): Promise<{ status: string }> {
    return this.validatedRequest('/health', HealthResponseSchema);
  }

  // Configuration
  public async getConfig(): Promise<AppConfig> {
    return this.validatedRequest('/api/config', AppConfigSchema);
  }
}

export const apiClient = ApiClient.getInstance();
