/**
 * useAPIClient Hook
 * @description API client hook with typed methods, streaming, and AI support
 */

import { useState, useCallback, useRef } from 'react';
import { APIClient, type APIResponse, type APIError } from '../utils/api-client';

export interface UseAPIClientOptions {
  baseURL?: string;
  timeout?: number;
  onRequestStart?: () => void;
  onRequestEnd?: () => void;
  onError?: (error: APIError) => void;
}

export interface APIRequestState<T> {
  data: T | null;
  isLoading: boolean;
  error: APIError | null;
}

export interface UseAPIClientReturn {
  client: APIClient;
  get: <T>(path: string) => Promise<APIResponse<T>>;
  post: <T>(path: string, body?: unknown) => Promise<APIResponse<T>>;
  put: <T>(path: string, body?: unknown) => Promise<APIResponse<T>>;
  patch: <T>(path: string, body?: unknown) => Promise<APIResponse<T>>;
  delete: <T>(path: string) => Promise<APIResponse<T>>;
  stream: (path: string, body?: unknown, onChunk?: (chunk: string) => void) => Promise<void>;
  generateText: (prompt: string, options?: GenerateTextOptions) => Promise<string>;
  streamText: (prompt: string, onChunk: (chunk: string) => void, options?: GenerateTextOptions) => Promise<void>;
}

export interface GenerateTextOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
  history?: Array<{ role: string; content: string }>;
}

/**
 * API Client hook for React apps
 */
export function useAPIClient(options: UseAPIClientOptions = {}): UseAPIClientReturn {
  const {
    baseURL = '',
    timeout = 30000,
    onRequestStart,
    onRequestEnd,
    onError,
  } = options;

  const clientRef = useRef<APIClient>(new APIClient({ baseURL, timeout }));

  /**
   * Wrap request with lifecycle hooks
   */
  const wrapRequest = useCallback(async <T,>(
    requestFn: () => Promise<APIResponse<T>>
  ): Promise<APIResponse<T>> => {
    try {
      onRequestStart?.();
      const response = await requestFn();
      return response;
    } catch (error) {
      const apiError = error as APIError;
      onError?.(apiError);
      throw apiError;
    } finally {
      onRequestEnd?.();
    }
  }, [onRequestStart, onRequestEnd, onError]);

  /**
   * GET request
   */
  const get = useCallback(async <T,>(path: string): Promise<APIResponse<T>> => {
    return wrapRequest<T>(() => clientRef.current.get<T>(path));
  }, [wrapRequest]);

  /**
   * POST request
   */
  const post = useCallback(async <T,>(
    path: string,
    body?: unknown
  ): Promise<APIResponse<T>> => {
    return wrapRequest<T>(() => clientRef.current.post<T>(path, body));
  }, [wrapRequest]);

  /**
   * PUT request
   */
  const put = useCallback(async <T,>(
    path: string,
    body?: unknown
  ): Promise<APIResponse<T>> => {
    return wrapRequest<T>(() => clientRef.current.put<T>(path, body));
  }, [wrapRequest]);

  /**
   * PATCH request
   */
  const patch = useCallback(async <T,>(
    path: string,
    body?: unknown
  ): Promise<APIResponse<T>> => {
    return wrapRequest<T>(() => clientRef.current.patch<T>(path, body));
  }, [wrapRequest]);

  /**
   * DELETE request
   */
  const deleteReq = useCallback(async <T,>(path: string): Promise<APIResponse<T>> => {
    return wrapRequest<T>(() => clientRef.current.delete<T>(path));
  }, [wrapRequest]);

  /**
   * Stream request
   */
  const stream = useCallback(async (
    path: string,
    body?: unknown,
    onChunk?: (chunk: string) => void
  ): Promise<void> => {
    return wrapRequest(() =>
      clientRef.current.stream(path, body, onChunk ? onChunk : () => {})
    );
  }, [wrapRequest]);

  /**
   * Generate text (AI)
   */
  const generateText = useCallback(async (
    prompt: string,
    options: GenerateTextOptions = {}
  ): Promise<string> => {
    const response = await wrapRequest(() =>
      clientRef.current.post<{ text: string }>('/api/ai/generate', {
        prompt,
        ...options,
      })
    );
    return response.data.text;
  }, [wrapRequest]);

  /**
   * Stream text (AI)
   */
  const streamText = useCallback(async (
    prompt: string,
    onChunk: (chunk: string) => void,
    options: GenerateTextOptions = {}
  ): Promise<void> => {
    await wrapRequest(() =>
      clientRef.current.stream('/api/ai/stream', {
        prompt,
        ...options,
      }, onChunk)
    );
  }, [wrapRequest]);

  return {
    client: clientRef.current,
    get,
    post,
    put,
    patch: patch,
    delete: deleteReq,
    stream,
    generateText,
    streamText,
  };
}

/**
 * Simplified hook for data fetching
 */
export function useFetch<T>(path: string, options: UseAPIClientOptions = {}) {
  const [state, setState] = useState<APIRequestState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const { get } = useAPIClient(options);

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await get<T>(path);
      setState({
        data: response.data,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error as APIError,
      });
    }
  }, [get, path]);

  return {
    ...state,
    refetch,
  };
}

/**
 * Hook for mutations (POST, PUT, PATCH, DELETE)
 */
export function useMutation<TData, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<APIResponse<TData>>,
  options: UseAPIClientOptions = {}
) {
  const [state, setState] = useState<APIRequestState<TData>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const mutate = useCallback(async (variables: TVariables): Promise<TData> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      options.onRequestStart?.();
      const response = await mutationFn(variables);
      setState({
        data: response.data,
        isLoading: false,
        error: null,
      });
      options.onRequestEnd?.();
      return response.data;
    } catch (error) {
      const apiError = error as APIError;
      setState({
        data: null,
        isLoading: false,
        error: apiError,
      });
      options.onError?.(apiError);
      options.onRequestEnd?.();
      throw apiError;
    }
  }, [mutationFn, options]);

  return {
    ...state,
    mutate,
  };
}
