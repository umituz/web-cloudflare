
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ModelRequirements,
  Vector,
  VectorizeQueryResult,
  VectorizeFilter,
  RAGResult,
  AIRequest,
  AIResponse,
  AICostSummary,
  ProviderCallOptions,
  ProviderCallResult,
} from '../entities';


export interface IWorkersAIService {
  callLLM<T = unknown>(
    model: string,
    request: LLMRequest,
    options?: {
      stream?: boolean;
      trackNeurons?: boolean;
      trackCost?: boolean;
    }
  ): Promise<LLMResponse<T>>;

  streamLLM(
    model: string,
    request: LLMRequest
  ): ReadableStream<LLMStreamChunk>;

  selectModel(requirements: ModelRequirements): string;

  trackNeuronUsage(model: string, tokens: number): number;

  calculateCost(model: string, neurons: number): number;

  getAvailableModels(): string[];

  getModelInfo(model: string): {
    name: string;
    contextLength: number;
    neuronsPer1KTokens: number;
    costPer1KNeurons: number;
  } | null;
}


export interface IEmbeddingService {
  generateTextEmbedding(
    text: string | string[],
    model?: string
  ): Promise<number[] | number[][]>;

  generateImageEmbedding(
    image: ArrayBuffer | string,
    model?: string
  ): Promise<number[]>;

  batchEmbeddings(
    inputs: string[],
    options?: {
      batchSize?: number;
      model?: string;
    }
  ): Promise<number[][]>;

  calculateSimilarity(
    embedding1: number[],
    embedding2: number[]
  ): number;

  findMostSimilar(
    query: number[],
    candidates: number[][]
  ): { index: number; score: number };
}


export interface IVectorizeService {
  bindIndex(name: string, index: VectorizeIndex): void;

  getIndex(name: string): VectorizeIndex | undefined;

  upsert(
    vectors: Vector[],
    binding?: string
  ): Promise<void>;

  query(
    vector: number[],
    options?: {
      topK?: number;
      filter?: VectorizeFilter;
      binding?: string;
    }
  ): Promise<VectorizeQueryResult[]>;

  delete(ids: string[], binding?: string): Promise<void>;

  get(id: string, binding?: string): Promise<Vector | null>;

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

  getStats(binding?: string): Promise<{
    count: number;
    dimension: number;
  }>;
}


export interface ILLMStreamingService {
  streamRequest(
    provider: 'workers-ai' | 'openai' | 'anthropic',
    model: string,
    request: LLMRequest
  ): ReadableStream<LLMStreamChunk>;

  streamToGenerator(
    stream: ReadableStream
  ): AsyncGenerator<LLMStreamChunk>;

  accumulateStream(
    stream: ReadableStream,
    onChunk?: (chunk: string) => void
  ): Promise<string>;
}


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


export interface IAIService {
  workersAI: IWorkersAIService;
  embedding: IEmbeddingService;
  vectorize: IVectorizeService;
  streaming: ILLMStreamingService;
  gateway: IAIGatewayService;
}
