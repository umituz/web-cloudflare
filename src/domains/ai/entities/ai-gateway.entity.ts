/**
 * AI Gateway Entities
 * @description Core entities for AI Gateway operations
 */

export interface ProviderCallOptions {
  returnRawResponse?: boolean;
  gatewayId?: string;
  responseType?: 'json' | 'text' | 'arraybuffer' | 'blob';
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ProviderCallResult<T = unknown> {
  data: T | Response;
  model: string;
  provider: string;
  tokens: number;
  cost: number;
  latency: number;
  cached: boolean;
  metadata?: Record<string, unknown>;
}
