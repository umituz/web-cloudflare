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
  ProviderCallOptions,
  ProviderCallResult,
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

export interface IAIGatewayService {
  route(request: AIRequest): Promise<AIResponse>;

  callProvider<T = unknown>(
    provider: 'huggingface' | 'workers-ai' | 'openai' | 'anthropic' | 'cohere' | 'custom',
    model: string,
    payload: unknown,
    options?: ProviderCallOptions
  ): Promise<ProviderCallResult<T>>;

  callHuggingFace<T = unknown>(
    model: string,
    payload: unknown,
    options?: Omit<ProviderCallOptions, 'gatewayId'>
  ): Promise<ProviderCallResult<T>>;

  buildHuggingFaceGatewayURL(model: string, gatewayId?: string): string;

  trackCost(data: {
    provider: string;
    model: string;
    neurons: number;
    cost: number;
    userId?: string;
  }): Promise<void>;

  getCostSummary(period?: 'hour' | 'day' | 'week' | 'month'): Promise<AICostSummary>;

  enforceBudget(budget: number, provider?: string): boolean;

  getCached(key: string): Promise<AIResponse | null>;

  getCachedSemantic(
    embedding: number[],
    threshold: number
  ): Promise<AIResponse | null>;

  saveToCache(key: string, response: AIResponse): Promise<void>;

  getAnalytics(): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalNeurons: number;
    totalCost: number;
    cacheHitRate: number;
    providerUsage: Record<string, number>;
  }>;

  isProviderAvailable(provider: string): boolean;

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
