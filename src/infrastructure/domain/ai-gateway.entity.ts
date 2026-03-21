/**
 * Cloudflare AI Gateway Domain Entity
 * @description AI Gateway for routing, caching, and analytics
 */

export interface AIGatewayConfig {
  gatewayId: string;
  providers: AIProvider[];
  cacheEnabled?: boolean;
  cacheTTL?: number; // seconds
  rateLimiting?: boolean;
  analytics?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'workers-ai' | 'openai' | 'anthropic' | 'cohere' | 'custom';
  baseURL: string;
  apiKey: string;
  models: string[];
  fallbackProvider?: string;
  weight?: number; // For load balancing
}

export interface AIRequest {
  provider: string;
  model: string;
  prompt: string;
  parameters?: AIParameters;
  stream?: boolean;
  cacheKey?: string;
}

export interface AIParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  responseFormat?: 'text' | 'json' | 'json_object';
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
  };
  cached: boolean;
  timestamp: number;
}

export interface AIAnalytics {
  totalRequests: number;
  totalTokens: number;
  cacheHitRate: number;
  averageResponseTime: number;
  providerUsage: Record<string, number>;
  errorRate: number;
}

// Workers AI specific models
export interface WorkersAIModel {
  id: string;
  name: string;
  type: 'text-generation' | 'image-generation' | 'embedding' | 'translation' | 'classification';
  contextWindow?: number;
  pricing?: {
    inputPrice: number; // per 1M tokens
    outputPrice: number; // per 1M tokens
  };
}

export interface WorkersAIRequest {
  model: string;
  inputs: WorkersAIInputs;
}

export interface WorkersAIInputs {
  text_generation?: {
    prompt: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop_sequences?: string[];
  };
  image_generation?: {
    prompt: string;
    width?: number;
    height?: number;
    steps?: number;
    seed?: number;
  };
  embedding?: {
    text: string;
    model?: string;
  };
  translation?: {
    text: string;
    source_lang: string;
    target_lang: string;
  };
}

export interface WorkersAIResponse {
  success: boolean;
  data?: {
    output?: string | string[];
    embedding?: number[];
    image?: string; // base64
  };
  error?: string;
  model: string;
}

// Available Workers AI models
export const WORKERS_AI_MODELS: Record<string, WorkersAIModel> = {
  '@cf/meta/llama-3.1-8b-instruct': {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    type: 'text-generation',
    contextWindow: 128000,
  },
  '@cf/mistral/mistral-7b-instruct': {
    id: '@cf/mistral/mistral-7b-instruct',
    name: 'Mistral 7B Instruct',
    type: 'text-generation',
    contextWindow: 8192,
  },
  '@cf/qwen/qwen2-7b-instruct': {
    id: '@cf/qwen/qwen2-7b-instruct',
    name: 'Qwen2 7B Instruct',
    type: 'text-generation',
    contextWindow: 32768,
  },
  '@cf/google/deeplab-v3-plus': {
    id: '@cf/google/deeplab-v3-plus',
    name: 'DeepLab V3+',
    type: 'classification',
  },
  '@cf/openai/clip-vit-base-patch32': {
    id: '@cf/openai/clip-vit-base-patch32',
    name: 'CLIP ViT Base',
    type: 'embedding',
  },
};

// Emotion control for script generation (from voice cloning app)
export interface EmotionControl {
  emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited' | 'calm' | 'surprised';
  intensity: number; // 0-1
}

export interface ScriptGenerationRequest {
  topic: string;
  emotion: EmotionControl;
  duration: number; // seconds
  style?: 'formal' | 'casual' | 'enthusiastic' | 'professional';
  keywords?: string[];
}
