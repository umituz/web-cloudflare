/**
 * AI Service Interfaces
 * @description TypeScript interfaces for AI services
 */

import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ModelRequirements,
  EmbeddingRequest,
  EmbeddingResponse,
  Vector,
  VectorizeQueryResult,
  VectorizeFilter,
  RAGResult,
  AIGatewayConfig,
  AIRequest,
  AIResponse,
  AICostSummary,
} from '../entities';

// ============================================================
// Workers AI Service Interface
// ============================================================

/**
 * Workers AI Service interface
 * @description Generic LLM calls with streaming and neuron tracking
 */
export interface IWorkersAIService {
  /**
   * Generic LLM call
   * @param model Model identifier
   * @param request LLM request
   * @param options Call options
   * @returns LLM response
   */
  callLLM<T = unknown>(
    model: string,
    request: LLMRequest,
    options?: {
      stream?: boolean;
      trackNeurons?: boolean;
      trackCost?: boolean;
    }
  ): Promise<LLMResponse<T>>;

  /**
   * Stream LLM response
   * @param model Model identifier
   * @param request LLM request
   * @returns Readable stream of chunks
   */
  streamLLM(
    model: string,
    request: LLMRequest
  ): ReadableStream<LLMStreamChunk>;

  /**
   * Select model based on requirements
   * @param requirements Model requirements
   * @returns Model identifier
   */
  selectModel(requirements: ModelRequirements): string;

  /**
   * Track neuron usage
   * @param model Model identifier
   * @param tokens Token count
   * @returns Neuron count
   */
  trackNeuronUsage(model: string, tokens: number): number;

  /**
   * Calculate cost for model usage
   * @param model Model identifier
   * @param neurons Neuron count
   * @returns Cost in USD
   */
  calculateCost(model: string, neurons: number): number;

  /**
   * Get available models
   * @returns List of model identifiers
   */
  getAvailableModels(): string[];

  /**
   * Get model information
   * @param model Model identifier
   * @returns Model metadata
   */
  getModelInfo(model: string): {
    name: string;
    contextLength: number;
    neuronsPer1KTokens: number;
    costPer1KNeurons: number;
  } | null;
}

// ============================================================
// Embedding Service Interface
// ============================================================

/**
 * Embedding Service interface
 * @description Text and image embedding generation
 */
export interface IEmbeddingService {
  /**
   * Generate text embedding
   * @param text Text or texts to embed
   * @param model Model to use (optional)
   * @returns Embedding vector or vectors
   */
  generateTextEmbedding(
    text: string | string[],
    model?: string
  ): Promise<number[] | number[][]>;

  /**
   * Generate image embedding
   * @param image Image data or URL
   * @param model Model to use (optional)
   * @returns Embedding vector
   */
  generateImageEmbedding(
    image: ArrayBuffer | string,
    model?: string
  ): Promise<number[]>;

  /**
   * Generate embeddings in batch
   * @param inputs Text inputs
   * @param options Batch options
   * @returns Embedding vectors
   */
  batchEmbeddings(
    inputs: string[],
    options?: {
      batchSize?: number;
      model?: string;
    }
  ): Promise<number[][]>;

  /**
   * Calculate similarity between embeddings
   * @param embedding1 First embedding
   * @param embedding2 Second embedding
   * @returns Similarity score (0-1)
   */
  calculateSimilarity(
    embedding1: number[],
    embedding2: number[]
  ): number;

  /**
   * Find most similar embedding
   * @param query Query embedding
   * @param candidates Candidate embeddings
   * @returns Most similar match
   */
  findMostSimilar(
    query: number[],
    candidates: number[][]
  ): { index: number; score: number };
}

// ============================================================
// Vectorize Service Interface
// ============================================================

/**
 * Vectorize Service interface
 * @description Vector index management and semantic search
 */
export interface IVectorizeService {
  /**
   * Bind a Vectorize index
   * @param name Index name
   * @param index VectorizeIndex binding
   */
  bindIndex(name: string, index: VectorizeIndex): void;

  /**
   * Get bound index
   * @param name Index name
   * @returns VectorizeIndex binding
   */
  getIndex(name: string): VectorizeIndex | undefined;

  /**
   * Upsert vectors to index
   * @param vectors Vectors to upsert
   * @param binding Index name (optional)
   */
  upsert(
    vectors: Vector[],
    binding?: string
  ): Promise<void>;

  /**
   * Query vector index
   * @param vector Query vector
   * @param options Query options
   * @returns Query results
   */
  query(
    vector: number[],
    options?: {
      topK?: number;
      filter?: VectorizeFilter;
      binding?: string;
    }
  ): Promise<VectorizeQueryResult[]>;

  /**
   * Delete vectors by ID
   * @param ids Vector IDs
   * @param binding Index name (optional)
   */
  delete(ids: string[], binding?: string): Promise<void>;

  /**
   * Get vector by ID
   * @param id Vector ID
   * @param binding Index name (optional)
   * @returns Vector or null
   */
  get(id: string, binding?: string): Promise<Vector | null>;

  /**
   * Perform RAG query
   * @param queryVector Query embedding
   * @param contextDocuments Context documents
   * @param options RAG options
   * @returns RAG result
   */
  ragQuery(
    queryVector: number[],
    contextDocuments: Array<{
      id: string;
      text: string;
      metadata?: Record<string, unknown>;
    }>,
    options?: {
      topK?: number;
      binding?: string;
    }
  ): Promise<RAGResult>;

  /**
   * Get index statistics
   * @param binding Index name (optional)
   * @returns Index statistics
   */
  getStats(binding?: string): Promise<{
    count: number;
    dimension: number;
  }>;
}

// ============================================================
// LLM Streaming Service Interface
// ============================================================

/**
 * LLM Streaming Service interface
 * @description Generic streaming support for LLM providers
 */
export interface ILLMStreamingService {
  /**
   * Create streaming request
   * @param provider Provider type
   * @param model Model identifier
   * @param request LLM request
   * @returns Readable stream
   */
  streamRequest(
    provider: 'workers-ai' | 'openai' | 'anthropic',
    model: string,
    request: LLMRequest
  ): ReadableStream<LLMStreamChunk>;

  /**
   * Convert SSE stream to async generator
   * @param stream Readable stream
   * @returns Async generator of chunks
   */
  streamToGenerator(
    stream: ReadableStream
  ): AsyncGenerator<LLMStreamChunk>;

  /**
   * Accumulate streaming response
   * @param stream Readable stream
   * @param onChunk Callback for each chunk
   * @returns Complete response
   */
  accumulateStream(
    stream: ReadableStream,
    onChunk?: (chunk: string) => void
  ): Promise<string>;
}

// ============================================================
// AI Gateway Service Interface
// ============================================================

/**
 * AI Gateway Service interface
 * @description Multi-provider routing with caching and fallback
 */

/**
 * Provider call options
 */
export interface ProviderCallOptions {
  /** Return raw Response object instead of parsed JSON */
  returnRawResponse?: boolean;
  /** Custom gateway ID override */
  gatewayId?: string;
  /** Expected response type for binary data */
  responseType?: 'json' | 'text' | 'arraybuffer' | 'blob';
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Provider call result
 */
export interface ProviderCallResult<T = unknown> {
  /** Response data (parsed or raw) */
  data: T | Response;
  /** Model used */
  model: string;
  /** Provider used */
  provider: string;
  /** Estimated tokens processed */
  tokens: number;
  /** Estimated cost in USD */
  cost: number;
  /** Request latency in milliseconds */
  latency: number;
  /** Whether response was from cache */
  cached: boolean;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

export interface IAIGatewayService {
  /**
   * Route AI request to appropriate provider
   * @param request AI request
   * @returns AI response
   */
  route(request: AIRequest): Promise<AIResponse>;

  /**
   * Generic call to any AI provider ⭐ NEW v1.6.5
   * @param provider Provider type
   * @param model Model identifier
   * @param payload Request payload
   * @param options Call options
   * @returns Provider call result
   */
  callProvider<T = unknown>(
    provider: 'huggingface' | 'workers-ai' | 'openai' | 'anthropic' | 'cohere' | 'custom',
    model: string,
    payload: unknown,
    options?: ProviderCallOptions
  ): Promise<ProviderCallResult<T>>;

  /**
   * Call Hugging Face model via Cloudflare AI Gateway ⭐ NEW v1.6.5
   * @param model Hugging Face model identifier
   * @param payload Request payload
   * @param options Call options
   * @returns Provider call result
   */
  callHuggingFace<T = unknown>(
    model: string,
    payload: unknown,
    options?: Omit<ProviderCallOptions, 'gatewayId'>
  ): Promise<ProviderCallResult<T>>;

  /**
   * Build Cloudflare AI Gateway URL for Hugging Face ⭐ NEW v1.6.5
   * @param model Hugging Face model identifier
   * @param gatewayId Gateway ID (optional)
   * @returns Complete gateway URL
   */
  buildHuggingFaceGatewayURL(model: string, gatewayId?: string): string;

  /**
   * Track AI call cost
   * @param data Cost data
   */
  trackCost(data: {
    provider: string;
    model: string;
    neurons: number;
    cost: number;
    userId?: string;
  }): Promise<void>;

  /**
   * Get cost summary
   * @param period Time period
   * @returns Cost summary
   */
  getCostSummary(period?: 'hour' | 'day' | 'week' | 'month'): Promise<AICostSummary>;

  /**
   * Enforce budget limit
   * @param budget Budget amount
   * @param provider Provider filter (optional)
   * @returns Whether within budget
   */
  enforceBudget(budget: number, provider?: string): boolean;

  /**
   * Get cached AI response (exact match)
   * @param key Cache key
   * @returns Cached response or null
   */
  getCached(key: string): Promise<AIResponse | null>;

  /**
   * Get cached AI response (semantic match)
   * @param embedding Query embedding
   * @param threshold Similarity threshold
   * @returns Cached response or null
   */
  getCachedSemantic(
    embedding: number[],
    threshold: number
  ): Promise<AIResponse | null>;

  /**
   * Save response to cache
   * @param key Cache key
   * @param response AI response
   */
  saveToCache(key: string, response: AIResponse): Promise<void>;

  /**
   * Get analytics
   * @returns Analytics data
   */
  getAnalytics(): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalNeurons: number;
    totalCost: number;
    cacheHitRate: number;
    providerUsage: Record<string, number>;
  }>;

  /**
   * Check circuit breaker for provider
   * @param provider Provider ID
   * @returns Whether provider is available
   */
  isProviderAvailable(provider: string): boolean;

  /**
   * Reset circuit breaker for provider
   * @param provider Provider ID
   */
  resetCircuitBreaker(provider: string): void;
}

// ============================================================
// AI Service Interface
// ============================================================

/**
 * Main AI Service interface
 * @description Combines all AI service capabilities
 */
export interface IAIService {
  workersAI: IWorkersAIService;
  embedding: IEmbeddingService;
  vectorize: IVectorizeService;
  streaming: ILLMStreamingService;
  gateway: IAIGatewayService;
}
