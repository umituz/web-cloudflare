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

  // Audio Models (TTS - Text-to-Speech)
  '@cf/myshell-ai/melotts': {
    name: 'MeloTS Text-to-Speech',
    contextLength: 0,
    neuronsPer1KTokens: 500,
    costPer1KNeurons: 0.0005,
    capabilities: ['audio', 'tts', 'speech'],
  },
  '@cf/deepgram/aura-1': {
    name: 'Aura TTS v1',
    contextLength: 0,
    neuronsPer1KTokens: 400,
    costPer1KNeurons: 0.0004,
    capabilities: ['audio', 'tts', 'speech'],
  },
  '@cf/deepgram/aura-asteria-en': {
    name: 'Aura Asteria English',
    contextLength: 0,
    neuronsPer1KTokens: 400,
    costPer1KNeurons: 0.0004,
    capabilities: ['audio', 'tts', 'speech', 'english'],
  },
  '@cf/deepgram/aura-luna-en': {
    name: 'Aura Luna English',
    contextLength: 0,
    neuronsPer1KTokens: 400,
    costPer1KNeurons: 0.0004,
    capabilities: ['audio', 'tts', 'speech', 'english'],
  },
  '@cf/deepgram/aura-stella-en': {
    name: 'Aura Stella English',
    contextLength: 0,
    neuronsPer1KTokens: 400,
    costPer1KNeurons: 0.0004,
    capabilities: ['audio', 'tts', 'speech', 'english'],
  },

  // Audio Models (ASR - Automatic Speech Recognition)
  '@cf/deepgram/nova-2': {
    name: 'Deepgram Nova-2',
    contextLength: 0,
    neuronsPer1KTokens: 300,
    costPer1KNeurons: 0.0003,
    capabilities: ['audio', 'asr', 'transcription'],
  },
  '@cf/openai/whisper': {
    name: 'OpenAI Whisper',
    contextLength: 0,
    neuronsPer1KTokens: 350,
    costPer1KNeurons: 0.00035,
    capabilities: ['audio', 'asr', 'transcription'],
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
  // Text-to-Speech (TTS) Methods
  // ============================================================

  /**
   * Generate speech from text using Workers AI TTS models
   * @param model TTS model (default: '@cf/myshell-ai/melotts')
   * @param text Text to convert to speech
   * @param options TTS options
   * @returns Base64 encoded audio (MP3)
   */
  async generateSpeech(
    text: string,
    options: {
      model?: string;
      lang?: string;
      returnRawResponse?: boolean;
    } = {}
  ): Promise<{ audio: string; format: string; model: string }> {
    const ai = this.getAI();

    if (!ai) {
      throw new Error('Workers AI binding not configured');
    }

    const model = options.model || '@cf/myshell-ai/melotts';
    const modelInfo = MODELS[model];

    if (!modelInfo || !modelInfo.capabilities.includes('tts')) {
      throw new Error(`Model ${model} does not support TTS`);
    }

    try {
      const params: Record<string, unknown> = {
        text,
      };

      // Add language parameter for MeloTS
      if (model.includes('melotts')) {
        params.lang = options.lang || 'en';
      }

      const response = await ai.run(model, params);

      // MeloTS returns { audio: "base64..." }
      if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;
        if ('audio' in r && typeof r.audio === 'string') {
          return {
            audio: r.audio,
            format: 'mp3',
            model,
          };
        }
      }

      // If returnRawResponse, return as-is
      if (options.returnRawResponse) {
        return {
          audio: typeof response === 'string' ? response : JSON.stringify(response),
          format: 'mp3',
          model,
        };
      }

      throw new Error('Unexpected response format from TTS model');

    } catch (error) {
      throw new Error(
        `TTS generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================
  // Automatic Speech Recognition (ASR) Methods
  // ============================================================

  /**
   * Transcribe audio to text using Workers AI ASR models
   * @param audio Audio data (ArrayBuffer, Uint8Array, or base64 string)
   * @param options ASR options
   * @returns Transcription result with text and metadata
   */
  async transcribeAudio(
    audio: ArrayBuffer | Uint8Array | string,
    options: {
      model?: string;
      detectLanguage?: boolean;
      language?: string;
      returnRawResponse?: boolean;
    } = {}
  ): Promise<{ text: string; language?: string; duration?: number; model: string }> {
    const ai = this.getAI();

    if (!ai) {
      throw new Error('Workers AI binding not configured');
    }

    const model = options.model || '@cf/openai/whisper';
    const modelInfo = MODELS[model];

    if (!modelInfo || !modelInfo.capabilities.includes('asr')) {
      throw new Error(`Model ${model} does not support ASR`);
    }

    try {
      // Prepare audio input
      let audioInput: Record<string, unknown>;

      if (typeof audio === 'string') {
        // Base64 string - convert to Uint8Array
        const binaryString = atob(audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        audioInput = {
          audio: Array.from(bytes),
        };
      } else if (audio instanceof Uint8Array) {
        audioInput = {
          audio: Array.from(audio),
        };
      } else {
        // ArrayBuffer
        audioInput = {
          audio: Array.from(new Uint8Array(audio)),
        };
      }

      // Add ASR-specific parameters
      if (options.detectLanguage) {
        audioInput.detect_language = options.detectLanguage;
      }

      if (options.language) {
        audioInput.language = options.language;
      }

      const response = await ai.run(model, audioInput);

      // Extract transcription text
      let text = '';
      let language: string | undefined;

      if (typeof response === 'string') {
        text = response;
      } else if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;

        // Whisper format: { text: "...", language: "en" }
        if ('text' in r && typeof r.text === 'string') {
          text = r.text;
        }

        if ('language' in r && typeof r.language === 'string') {
          language = r.language;
        }

        // Nova-2 format: { result: "...", detected_language: "en" }
        if ('result' in r && typeof r.result === 'string') {
          text = r.result;
        }

        if ('detected_language' in r && typeof r.detected_language === 'string') {
          language = r.detected_language;
        }
      }

      if (!text) {
        throw new Error('Could not extract transcription from response');
      }

      return {
        text,
        language,
        model,
      };

    } catch (error) {
      throw new Error(
        `ASR transcription failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get available TTS models
   */
  getAvailableTTSModels(): string[] {
    return Object.entries(MODELS)
      .filter(([_, info]) => info.capabilities.includes('tts'))
      .map(([model, _]) => model);
  }

  /**
   * Get available ASR models
   */
  getAvailableASRModels(): string[] {
    return Object.entries(MODELS)
      .filter(([_, info]) => info.capabilities.includes('asr'))
      .map(([model, _]) => model);
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
