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
} from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

  // Stock
  public async getStockMetrics(ticker: string, period: string = '1d', interval: string = '1m'): Promise<StockMetrics> {
    const query = new URLSearchParams({ period, interval });
    return this.request<StockMetrics>(`/api/stock/${ticker}?${query.toString()}`);
  }

  public async getStockHistory(ticker: string, period: string = '1d', interval: string = '1m'): Promise<StockHistoryPoint[]> {
    const query = new URLSearchParams({ period, interval });
    return this.request<StockHistoryPoint[]>(`/api/stock/${ticker}/history?${query.toString()}`);
  }

  public async getStockIndicators(ticker: string, period: string = '1d', interval: string = '1m'): Promise<StockIndicatorsPoint[]> {
    const query = new URLSearchParams({ period, interval });
    return this.request<StockIndicatorsPoint[]>(`/api/stock/${ticker}/indicators?${query.toString()}`);
  }

  // Sentiment
  public async getSentiment(ticker: string): Promise<SentimentResponse> {
    return this.request<SentimentResponse>(`/api/sentiment/${ticker}`);
  }

  // Macro
  public async getLiquidity(days?: number): Promise<LiquidityPoint[]> {
    const query = days ? `?days=${days}` : '';
    return this.request<LiquidityPoint[]>(`/api/macro/liquidity${query}`);
  }

  public async getDebtStatus(days?: number): Promise<DebtPoint[]> {
    const query = days ? `?days=${days}` : '';
    return this.request<DebtPoint[]>(`/api/macro/debt-status${query}`);
  }

  public async getRealRates(): Promise<RealRatePoint[]> {
    return this.request<RealRatePoint[]>('/api/macro/real-rates');
  }

  public async getCpi(days?: number): Promise<CPIPoint[]> {
    const query = days ? `?days=${days}` : '';
    return this.request<CPIPoint[]>(`/api/macro/cpi${query}`);
  }

  // Crypto
  public async getCryptoDominance(days: number = 365): Promise<CryptoDominanceResponse> {
    const query = `?days=${days}`;
    return this.request<CryptoDominanceResponse>(`/api/crypto/dominance${query}`);
  }

  // Risk / Regression Bands
  public async getRiskData(ticker: string): Promise<RiskResponse> {
    return this.request<RiskResponse>(`/api/v1/risk/${ticker}`);
  }

  public async getRiskScore(ticker: string): Promise<RiskScoreResponse> {
    return this.request<RiskScoreResponse>(`/api/v1/risk/${ticker}/score`);
  }

  // Health
  public async checkHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }
}

export const apiClient = ApiClient.getInstance();
