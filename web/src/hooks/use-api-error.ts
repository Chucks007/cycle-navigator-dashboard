/**
 * API Error Handling Hook
 *
 * Provides consistent error handling and retry functionality
 * for API calls using React Query.
 *
 * Features:
 * - Exponential backoff retry
 * - Error message extraction
 * - Loading/error state management
 * - Custom error callbacks
 */

import { useCallback, useState } from "react";
import { useQueryClient, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";

// ============================================
// Types
// ============================================

export interface ApiError {
  message: string;
  status?: number;
  detail?: string;
  isNetworkError: boolean;
  isServerError: boolean;
  isClientError: boolean;
}

export interface UseApiErrorOptions {
  /** Callback when error occurs */
  onError?: (error: ApiError) => void;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  retryDelay?: number;
  /** Show toast notification on error */
  showToast?: boolean;
}

// ============================================
// Error Parsing
// ============================================

/**
 * Parse an error into a structured ApiError object.
 */
export function parseApiError(error: unknown): ApiError {
  // Default error
  const apiError: ApiError = {
    message: "An unexpected error occurred",
    isNetworkError: false,
    isServerError: false,
    isClientError: false,
  };

  if (error instanceof Error) {
    apiError.message = error.message;

    // Check for network errors
    if (
      error.message === "fetch failed" ||
      error.message.includes("Network request failed") ||
      error.message === "Backend Offline"
    ) {
      apiError.isNetworkError = true;
      apiError.message = "Unable to connect to server. Please check your connection.";
    }
  }

  // Handle Response errors with status
  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;

    if (typeof errObj.status === "number") {
      apiError.status = errObj.status;
      apiError.isServerError = errObj.status >= 500;
      apiError.isClientError = errObj.status >= 400 && errObj.status < 500;
    }

    if (typeof errObj.detail === "string") {
      apiError.detail = errObj.detail;
      apiError.message = errObj.detail;
    }
  }

  return apiError;
}

/**
 * Get a user-friendly error message.
 */
export function getErrorMessage(error: ApiError): string {
  if (error.isNetworkError) {
    return "Unable to connect to server. Please check your connection.";
  }

  if (error.isServerError) {
    return "Server error. Please try again later.";
  }

  if (error.status === 404) {
    return "The requested resource was not found.";
  }

  if (error.status === 401) {
    return "You need to be logged in to access this resource.";
  }

  if (error.status === 403) {
    return "You don't have permission to access this resource.";
  }

  if (error.status === 429) {
    return "Too many requests. Please slow down.";
  }

  return error.detail || error.message || "An unexpected error occurred.";
}

// ============================================
// Retry Logic
// ============================================

/**
 * Calculate retry delay with exponential backoff.
 */
export function calculateRetryDelay(
  attemptNumber: number,
  baseDelay: number = 1000
): number {
  // Exponential backoff: baseDelay * 2^attempt with some jitter
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), 30000);
  const jitter = Math.random() * 1000;
  return delay + jitter;
}

/**
 * Determine if an error should be retried.
 */
export function shouldRetry(error: ApiError, attemptNumber: number, maxRetries: number): boolean {
  if (attemptNumber >= maxRetries) {
    return false;
  }

  // Don't retry client errors (4xx) except 429 (rate limit)
  if (error.isClientError && error.status !== 429) {
    return false;
  }

  // Always retry network errors and server errors
  return error.isNetworkError || error.isServerError || error.status === 429;
}

// ============================================
// React Query Helpers
// ============================================

/**
 * Default React Query options for API calls with retry logic.
 */
export function createQueryOptions<TData>(
  options: UseApiErrorOptions = {}
): Partial<UseQueryOptions<TData, Error>> {
  const { maxRetries = 3, retryDelay = 1000, onError } = options;

  return {
    retry: (failureCount, error) => {
      const apiError = parseApiError(error);
      return shouldRetry(apiError, failureCount, maxRetries);
    },
    retryDelay: (attemptNumber) => calculateRetryDelay(attemptNumber, retryDelay),
    // Note: React Query v5 removed onError from useQuery options
    // Handle errors in the component using the error property
  };
}

// ============================================
// Hook: useApiError
// ============================================

/**
 * Hook for managing API errors with retry functionality.
 *
 * @example
 * ```tsx
 * const { error, isError, handleError, clearError, retry } = useApiError({
 *   onError: (err) => console.error(err),
 * });
 *
 * const { data } = useQuery({
 *   queryKey: ['data'],
 *   queryFn: fetchData,
 *   ...createQueryOptions(),
 * });
 *
 * if (isError) {
 *   return <ChartError message={error?.message} onRetry={retry} />;
 * }
 * ```
 */
export function useApiError(options: UseApiErrorOptions = {}) {
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const queryClient = useQueryClient();

  const handleError = useCallback(
    (err: unknown) => {
      const apiError = parseApiError(err);
      setError(apiError);
      options.onError?.(apiError);
    },
    [options]
  );

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  const retry = useCallback(
    (queryKey?: unknown[]) => {
      clearError();
      setRetryCount((c) => c + 1);

      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [clearError, queryClient]
  );

  return {
    error,
    isError: error !== null,
    errorMessage: error ? getErrorMessage(error) : null,
    handleError,
    clearError,
    retry,
    retryCount,
  };
}

// ============================================
// Hook: useQueryWithErrorHandling
// ============================================

/**
 * Wrapper hook that combines React Query with error handling.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, retry } = useQueryWithErrorHandling(
 *   ['liquidity'],
 *   () => apiClient.getLiquidity(),
 *   { onError: console.error }
 * );
 * ```
 */
export function useQueryWithErrorHandling<TData>(
  queryResult: UseQueryResult<TData, Error>,
  options: UseApiErrorOptions = {}
) {
  const { error: queryError, refetch } = queryResult;
  const { error, handleError, clearError, errorMessage } = useApiError(options);

  // Handle errors from React Query
  if (queryError && !error) {
    handleError(queryError);
  }

  // Clear error when query succeeds
  if (!queryError && error) {
    clearError();
  }

  const retry = useCallback(() => {
    clearError();
    refetch();
  }, [clearError, refetch]);

  return {
    ...queryResult,
    error: error || (queryError ? parseApiError(queryError) : null),
    errorMessage: errorMessage || (queryError ? getErrorMessage(parseApiError(queryError)) : null),
    retry,
  };
}
