/**
 * Workers AI Service
 * @description Generic LLM calls with streaming, neuron tracking, and cost estimation
 */

import type {
  IWorkersAIService,
  IEmbeddingService,
} from '../types';
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ModelRequirements,
  ChatMessage,
} from '../entities';
import type { WorkersAIBinding } from '../../../config/types';

// ============================================================
// Model Registry
// ============================================================

interface ModelInfo {
  name: string;
  contextLength: number;
  neuronsPer1KTokens: number;
  costPer1KNeurons: number;
  capabilities: string[];
}

const MODELS: Record<string, ModelInfo> = {
  // Text Generation Models
  '@cf/meta/llama-3.1-8b-instruct': {
    name: 'Llama 3.1 8B Instruct',
    contextLength: 131072,
    neuronsPer1KTokens: 208,
    costPer1KNeurons: 0.00015,
    capabilities: ['chat', 'completion'],
  },
  '@cf/meta/llama-3.3-70b-instruct': {
    name: 'Llama 3.3 70B Instruct',
    contextLength: 131072,
    neuronsPer1KTokens: 1110,
    costPer1KNeurons: 0.00045,
    capabilities: ['chat', 'completion'],
  },
  '@cf/mistral/mistral-7b-instruct': {
    name: 'Mistral 7B Instruct',
    contextLength: 32768,
    neuronsPer1KTokens: 208,
    costPer1KNeurons: 0.00015,
    capabilities: ['chat', 'completion'],
  },
  '@hf/google/gemma-7b-it': {
    name: 'Gemma 7B IT',
    contextLength: 8192,
    neuronsPer1KTokens: 208,
    costPer1KNeurons: 0.00015,
    capabilities: ['chat', 'completion'],
  },
  '@hf/thebloke/deepseek-coder-33b-instruct': {
    name: 'DeepSeek Coder 33B',
    contextLength: 16384,
    neuronsPer1KTokens: 500,
    costPer1KNeurons: 0.00025,
    capabilities: ['completion', 'code'],
  },

  // Image Generation Models
  '@cf/stabilityai/stable-diffusion-xl-base-1.0': {
    name: 'Stable Diffusion XL',
    contextLength: 0,
    neuronsPer1KTokens: 2778,
    costPer1KNeurons: 0.001,
    capabilities: ['image'],
  },

  // Embedding Models
  '@cf/openai/clip-vit-base-patch32': {
    name: 'CLIP ViT Base',
    contextLength: 77,
    neuronsPer1KTokens: 52,
    costPer1KNeurons: 0.0001,
    capabilities: ['embedding'],
  },
};

// ============================================================
// Workers AI Service Implementation
// ============================================================

export class WorkersAIService implements IWorkersAIService {
  private env: {
    AI?: WorkersAIBinding;
    bindings?: {
      AI?: WorkersAIBinding;
    };
  };

  constructor(env: { AI?: WorkersAIBinding; bindings?: { AI?: WorkersAIBinding } }) {
    this.env = env;
  }

  /**
   * Get Workers AI binding
   */
  private getAI(): WorkersAIBinding | null {
    return this.env.bindings?.AI || this.env.AI || null;
  }

  /**
   * Generic LLM call with full support
   */
  async callLLM<T = unknown>(
    model: string,
    request: LLMRequest,
    options: {
      stream?: boolean;
      trackNeurons?: boolean;
      trackCost?: boolean;
    } = {}
  ): Promise<LLMResponse<T>> {
    const ai = this.getAI();

    if (!ai) {
      throw new Error('Workers AI binding not configured');
    }

    const startTime = Date.now();
    const modelInfo = MODELS[model];

    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    // Prepare inputs based on request type
    const inputs: Record<string, unknown> = {
      prompt: request.prompt,
      messages: request.messages,
      ...request.parameters,
    };

    // Remove messages if using prompt-based model
    if (!inputs.messages) {
      delete inputs.messages;
    }

    try {
      const response = await ai.run(model, inputs);

      // Parse response
      const content = this.extractContent(response);
      const tokens = this.estimateTokens(content);

      // Calculate metrics
      const neurons = options.trackNeurons
        ? this.trackNeuronUsage(model, tokens)
        : 0;

      const cost = options.trackCost
        ? this.calculateCost(model, neurons)
        : 0;

      return {
        content,
        data: this.tryParseJSON<T>(content),
        usage: {
          promptTokens: Math.floor(tokens * 0.3),
          completionTokens: Math.floor(tokens * 0.7),
          totalTokens: tokens,
          neurons,
          cost,
        },
        model,
        cached: false,
        timestamp: Date.now(),
        id: this.generateId(),
      };

    } catch (error) {
      throw new Error(
        `Workers AI error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stream LLM response
   */
  streamLLM(
    model: string,
    request: LLMRequest
  ): ReadableStream<LLMStreamChunk> {
    const ai = this.getAI();

    if (!ai) {
      throw new Error('Workers AI binding not configured');
    }

    const modelInfo = MODELS[model];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    const requestId = this.generateId();
    let totalTokens = 0;

    // Create a TransformStream for streaming
    return new ReadableStream<LLMStreamChunk>({
      async start(controller) {
        try {
          const inputs: Record<string, unknown> = {
            prompt: request.prompt,
            messages: request.messages,
            stream: true,
            ...request.parameters,
          };

          // Note: Workers AI streaming support may vary
          // This is a simplified implementation
          const response = await ai.run(model, inputs);
          const content = String(response || '');

          // Send as single chunk for now
          // Real SSE streaming would require different implementation
          controller.enqueue({
            content,
            done: false,
            id: requestId,
          });

          totalTokens = Math.ceil(content.length / 4);

          controller.enqueue({
            content: '',
            done: true,
            usage: {
              promptTokens: Math.floor(totalTokens * 0.3),
              completionTokens: Math.floor(totalTokens * 0.7),
              totalTokens,
              neurons: 0,
              cost: 0,
            },
            id: requestId,
          });

          controller.close();

        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  /**
   * Select model based on requirements
   */
  selectModel(requirements: ModelRequirements): string {
    const candidates = Object.entries(MODELS).filter(([_, info]) =>
      info.capabilities.includes(requirements.task)
    );

    if (candidates.length === 0) {
      throw new Error(`No models found for task: ${requirements.task}`);
    }

    // Sort by requirements
    let sorted = candidates;

    // Filter by context length
    if (requirements.contextLength !== undefined) {
      sorted = sorted.filter(([_, info]) =>
        (info.contextLength ?? 0) >= requirements.contextLength!
      );
    }

    // Sort by speed preference
    if (requirements.speed) {
      const speedOrder = { 'fast': 0, 'balanced': 1, 'quality': 2 };
      sorted.sort((a, b) => {
        const costA = a[1].costPer1KNeurons;
        const costB = b[1].costPer1KNeurons;
        return requirements.speed === 'fast'
          ? costA - costB
          : costB - costA;
      });
    }

    // Sort by cost if cost sensitive
    if (requirements.costSensitive) {
      sorted.sort((a, b) =>
        a[1].costPer1KNeurons - b[1].costPer1KNeurons
      );
    }

    // Return first match
    return sorted[0]?.[0] || '@cf/meta/llama-3.1-8b-instruct';
  }

  /**
   * Track neuron usage for billing
   */
  trackNeuronUsage(model: string, tokens: number): number {
    const modelInfo = MODELS[model];
    if (!modelInfo) {
      return 0;
    }

    const neuronsPer1K = modelInfo.neuronsPer1KTokens;
    return Math.ceil((tokens / 1000) * neuronsPer1K);
  }

  /**
   * Calculate cost based on neuron usage
   */
  calculateCost(model: string, neurons: number): number {
    const modelInfo = MODELS[model];
    if (!modelInfo) {
      return 0;
    }

    const costPer1KNeurons = modelInfo.costPer1KNeurons;
    return (neurons / 1000) * costPer1KNeurons;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return Object.keys(MODELS);
  }

  /**
   * Get model information
   */
  getModelInfo(model: string): ModelInfo | null {
    return MODELS[model] || null;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Extract content from Workers AI response
   */
  private extractContent(response: unknown): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object') {
      const r = response as Record<string, unknown>;
      return String(
        r.response || r.output || r.text || r.content || JSON.stringify(response)
      );
    }

    return String(response || '');
  }

  /**
   * Try to parse JSON from content
   */
  private tryParseJSON<T>(content: string): T | undefined {
    try {
      const trimmed = content.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed) as T;
      }
    } catch {
      // Not JSON or invalid JSON
    }
    return undefined;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// ============================================================
// Singleton Instance
// ============================================================

export const workersAIService = new WorkersAIService({});
