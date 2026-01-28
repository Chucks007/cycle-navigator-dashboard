/**
 * Centralized API route definitions.
 * 
 * All API endpoint paths are defined here for consistency and maintainability.
 * When backend routes change, update them in this single location.
 */

export const API_ROUTES = {
  /**
   * Stock-related endpoints
   */
  STOCK: {
    METRICS: (ticker: string) => `/api/stock/${ticker}`,
    HISTORY: (ticker: string) => `/api/stock/${ticker}/history`,
    INDICATORS: (ticker: string) => `/api/stock/${ticker}/indicators`,
  },

  /**
   * Macro economic data endpoints
   */
  MACRO: {
    SUMMARY: '/api/macro/summary',
    LIQUIDITY: '/api/macro/liquidity',
    DEBT_STATUS: '/api/macro/debt-status',
    REAL_RATES: '/api/macro/real-rates',
    CPI: '/api/macro/cpi',
  },

  /**
   * Sentiment analysis endpoints
   */
  SENTIMENT: {
    BY_TICKER: (ticker: string) => `/api/sentiment/${ticker}`,
  },

  /**
   * Cryptocurrency endpoints
   */
  CRYPTO: {
    DOMINANCE: '/api/crypto/dominance',
  },

  /**
   * Comparison endpoints
   */
  COMPARISON: {
    BARBELL: '/api/comparison/barbell',
  },

  /**
   * Risk analysis endpoints (v1)
   */
  RISK: {
    DATA: (ticker: string) => `/api/v1/risk/${ticker}`,
    SCORE: (ticker: string) => `/api/v1/risk/${ticker}/score`,
  },

  /**
   * Application configuration
   */
  CONFIG: '/api/config',

  /**
   * Health check endpoints
   */
  HEALTH: '/health',
} as const;
