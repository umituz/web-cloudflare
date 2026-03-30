/**
 * AI Domain Entities
 * @description Core entities for AI services
 */

// ============================================================
// LLM (Large Language Model) Entities
// ============================================================

/**
 * LLM request configuration
 */
export interface LLMRequest {
  /** The prompt or message to send to the LLM */
  prompt: string;
  /** Chat messages for conversation-based models */
  messages?: ChatMessage[];
  /** Model parameters */
  parameters?: LLMParameters;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chat message for conversation-based LLMs
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM generation parameters
 */
export interface LLMParameters {
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Nucleus sampling threshold (0-1) */
  topP?: number;
  /** Top-K sampling */
  topK?: number;
  /** Response format */
  responseFormat?: 'text' | 'json';
  /** Stop sequences */
  stop?: string[];
  /** Frequency penalty (-2 to 2) */
  frequencyPenalty?: number;
  /** Presence penalty (-2 to 2) */
  presencePenalty?: number;
}

/**
 * LLM response with metadata
 */
export interface LLMResponse<T = unknown> {
  /** Generated content */
  content: string;
  /** Structured data (if responseFormat is 'json') */
  data?: T;
  /** Token usage information */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    /** Neurons used (Cloudflare billing metric) */
    neurons: number;
    /** Estimated cost in USD */
    cost: number;
  };
  /** Model used */
  model: string;
  /** Whether response was cached */
  cached: boolean;
  /** Response timestamp */
  timestamp: number;
  /** Request ID */
  id: string;
}

/**
 * Model selection requirements
 */
export interface ModelRequirements {
  /** Task type */
  task: 'chat' | 'completion' | 'embedding' | 'image';
  /** Required context length */
  contextLength?: number;
  /** Speed preference */
  speed?: 'fast' | 'balanced' | 'quality';
  /** Cost sensitivity */
  costSensitive?: boolean;
  /** Required capabilities */
  capabilities?: string[];
}

/**
 * Streaming chunk from LLM
 */
export interface LLMStreamChunk {
  /** Content chunk */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Usage information (available in final chunk) */
  usage?: LLMResponse['usage'];
  /** Request ID */
  id: string;
}

// ============================================================
// Embedding Entities
// ============================================================

/**
 * Embedding generation request
 */
export interface EmbeddingRequest {
  /** Text or image to embed */
  input: string | string[] | ArrayBuffer;
  /** Model to use */
  model?: string;
  /** Embedding dimensions */
  dimensions?: number;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  /** Generated embeddings */
  embeddings: number[] | number[][];
  /** Model used */
  model: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Usage information */
  usage: {
    tokens: number;
    neurons: number;
    cost: number;
  };
}

// ============================================================
// Vectorize Entities
// ============================================================

/**
 * Vector to upsert
 */
export interface Vector {
  /** Unique identifier */
  id: string;
  /** Vector values */
  values: number[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Vectorize query result
 */
export interface VectorizeQueryResult {
  /** Vector ID */
  id: string;
  /** Similarity score (0-1) */
  score: number;
  /** Vector metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Vectorize filter for queries
 */
export interface VectorizeFilter {
  /** Key-value pairs for filtering */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * RAG query result
 */
export interface RAGResult {
  /** Matched documents */
  matches: Array<{
    id: string;
    text: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  /** Combined context */
  context: string;
  /** Total matches found */
  totalMatches: number;
}

// ============================================================
// AI Gateway Entities
// ============================================================

/**
 * AI provider configuration
 */
export interface AIProvider {
  /** Unique provider ID */
  id: string;
  /** Provider name */
  name: string;
  /** Provider type */
  type: 'workers-ai' | 'openai' | 'anthropic' | 'cohere' | 'custom';
  /** Base URL for API calls */
  baseURL: string;
  /** API key */
  apiKey: string;
  /** Available models */
  models: string[];
  /** Provider weight for load balancing */
  weight?: number;
  /** Fallback provider ID */
  fallbackProvider?: string;
  /** Model pricing information */
  pricing?: {
    [model: string]: {
      inputCostPer1KTokens: number;
      outputCostPer1KTokens: number;
      neuronsPer1KTokens?: number;
      costPer1KNeurons?: number;
    };
  };
}

/**
 * AI gateway configuration
 */
export interface AIGatewayConfig {
  /** Gateway ID */
  gatewayId?: string;
  /** Available providers */
  providers: AIProvider[];
  /** Cache enabled */
  cacheEnabled?: boolean;
  /** Cache TTL in seconds */
  cacheTTL?: number;
  /** Rate limiting enabled */
  rateLimiting?: boolean;
  /** Analytics enabled */
  analytics?: boolean;
  /** Budget enforcement */
  budget?: {
    monthlyLimit: number;
    alertThreshold: number;
  };
}

/**
 * AI request through gateway
 */
export interface AIRequest {
  /** Provider to use (optional for load balancing) */
  provider?: string;
  /** Model to use */
  model: string;
  /** Prompt or messages */
  prompt: string;
  /** Chat messages for conversation-based models */
  messages?: ChatMessage[];
  /** Generation parameters */
  parameters?: LLMParameters;
  /** Stream response */
  stream?: boolean;
  /** Cache key for caching */
  cacheKey?: string;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AI response from gateway
 */
export interface AIResponse {
  /** Response ID */
  id: string;
  /** Provider used */
  provider: string;
  /** Model used */
  model: string;
  /** Generated content */
  content: string;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    neurons: number;
    cost: number;
  };
  /** Whether response was cached */
  cached: boolean;
  /** Response timestamp */
  timestamp: number;
  /** Response metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AI cost summary
 */
export interface AICostSummary {
  /** Total cost */
  totalCost: number;
  /** Cost by provider */
  byProvider: Record<string, number>;
  /** Cost by model */
  byModel: Record<string, number>;
  /** Total neurons used */
  totalNeurons: number;
  /** Total requests */
  totalRequests: number;
  /** Average cost per request */
  avgCostPerRequest: number;
}

// ============================================================
// Cost Tracking Entities
// ============================================================

/**
 * AI cost record
 */
export interface AICostRecord {
  /** Record ID */
  id: string;
  /** Provider used */
  provider: string;
  /** Model used */
  model: string;
  /** Neurons consumed */
  neurons: number;
  /** Cost in USD */
  cost: number;
  /** User ID (if applicable) */
  userId?: string;
  /** Timestamp */
  timestamp: number;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cost summary by period
 */
export interface CostSummary {
  /** Period type */
  period: 'hour' | 'day' | 'week' | 'month';
  /** Total cost */
  totalCost: number;
  /** Cost breakdown */
  breakdown: {
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
    byUser?: Record<string, number>;
  };
  /** Budget information */
  budget?: {
    limit: number;
    spent: number;
    remaining: number;
    percentage: number;
  };
}

/**
 * Cost optimization recommendation
 */
export interface CostRecommendation {
  /** Recommendation type */
  type: 'switch-model' | 'enable-caching' | 'adjust-parameters' | 'batch-requests';
  /** Recommendation title */
  title: string;
  /** Recommendation description */
  description: string;
  /** Estimated savings */
  estimatedSavings: number;
  /** Priority (1-10) */
  priority: number;
}

// ============================================================
// AI Quota Entities
// ============================================================

/**
 * AI quota configuration
 */
export interface AIQuotaConfig {
  /** Quota enabled */
  enabled: boolean;
  /** Neurons per period */
  quota: number;
  /** Period in seconds */
  period: number;
  /** User ID for quota tracking */
  userId?: string;
  /** Reset behavior */
  resetBehavior?: 'hard' | 'rolling';
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Remaining neurons */
  remaining: number;
  /** Reset timestamp */
  resetAt: number;
  /** Current usage */
  currentUsage: number;
}

// ============================================================
// Session Entities
// ============================================================

/**
 * Session data
 */
export interface SessionData {
  /** Session ID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Session creation time */
  createdAt: number;
  /** Session expiration time */
  expiresAt: number;
  /** Additional session data */
  data?: Record<string, unknown>;
}

/**
 * Session creation options
 */
export interface SessionOptions {
  /** Session TTL in seconds */
  ttl?: number;
  /** Additional data to store */
  data?: Record<string, unknown>;
}
