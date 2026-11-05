
export * from './ai-gateway.entity';


export interface LLMRequest {
  prompt: string;
  messages?: ChatMessage[];
  parameters?: LLMParameters;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  responseFormat?: 'text' | 'json';
  stop?: string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface LLMResponse<T = unknown> {
  content: string;
  data?: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    neurons: number;
    cost: number;
  };
  model: string;
  cached: boolean;
  timestamp: number;
  id: string;
}

export interface ModelRequirements {
  task: 'chat' | 'completion' | 'embedding' | 'image';
  contextLength?: number;
  speed?: 'fast' | 'balanced' | 'quality';
  costSensitive?: boolean;
  capabilities?: string[];
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: LLMResponse['usage'];
  id: string;
}


export interface EmbeddingRequest {
  input: string | string[] | ArrayBuffer;
  model?: string;
  dimensions?: number;
}

export interface EmbeddingResponse {
  embeddings: number[] | number[][];
  model: string;
  dimensions: number;
  usage: {
    tokens: number;
    neurons: number;
    cost: number;
  };
}


export interface Vector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorizeQueryResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorizeFilter {
  [key: string]: string | number | boolean | null | undefined;
}

export interface RAGResult {
  matches: Array<{
    id: string;
    text: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  context: string;
  totalMatches: number;
}


export interface AIProvider {
  id: string;
  name: string;
  type: 'workers-ai' | 'openai' | 'anthropic' | 'cohere' | 'custom';
  baseURL: string;
  apiKey: string;
  models: string[];
  weight?: number;
  fallbackProvider?: string;
  pricing?: {
    [model: string]: {
      inputCostPer1KTokens: number;
      outputCostPer1KTokens: number;
      neuronsPer1KTokens?: number;
      costPer1KNeurons?: number;
    };
  };
}

export interface AIGatewayConfig {
  gatewayId?: string;
  providers: AIProvider[];
  cacheEnabled?: boolean;
  cacheTTL?: number;
  rateLimiting?: boolean;
  analytics?: boolean;
  budget?: {
    monthlyLimit: number;
    alertThreshold: number;
  };
}

export interface AIRequest {
  provider?: string;
  model: string;
  prompt: string;
  messages?: ChatMessage[];
  parameters?: LLMParameters;
  stream?: boolean;
  cacheKey?: string;
  metadata?: Record<string, unknown>;
}

export interface AIResponse {
  id: string;
  provider: string;
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    neurons: number;
    cost: number;
  };
  cached: boolean;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AICostSummary {
  totalCost: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  totalNeurons: number;
  totalRequests: number;
  avgCostPerRequest: number;
}


export interface AICostRecord {
  id: string;
  provider: string;
  model: string;
  neurons: number;
  cost: number;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  period: 'hour' | 'day' | 'week' | 'month';
  totalCost: number;
  breakdown: {
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
    byUser?: Record<string, number>;
  };
  budget?: {
    limit: number;
    spent: number;
    remaining: number;
    percentage: number;
  };
}

export interface CostRecommendation {
  type: 'switch-model' | 'enable-caching' | 'adjust-parameters' | 'batch-requests';
  title: string;
  description: string;
  estimatedSavings: number;
  priority: number;
}


export interface AIQuotaConfig {
  enabled: boolean;
  quota: number;
  period: number;
  userId?: string;
  resetBehavior?: 'hard' | 'rolling';
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  currentUsage: number;
}


export interface SessionData {
  sessionId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  data?: Record<string, unknown>;
}

export interface SessionOptions {
  ttl?: number;
  data?: Record<string, unknown>;
}
