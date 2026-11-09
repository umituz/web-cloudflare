
import type {
  IWorkersAIService,
} from '../types';
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ModelRequirements,
} from '../entities';
import type { WorkersAIBinding } from '../../../config/types';
import { generateId } from '../../../infrastructure/utils/helpers';


interface ModelInfo {
  name: string;
  contextLength: number;
  neuronsPer1KTokens: number;
  costPer1KNeurons: number;
  capabilities: string[];
}

const MODELS: Record<string, ModelInfo> = {
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

  '@cf/stabilityai/stable-diffusion-xl-base-1.0': {
    name: 'Stable Diffusion XL',
    contextLength: 0,
    neuronsPer1KTokens: 2778,
    costPer1KNeurons: 0.001,
    capabilities: ['image'],
  },

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
  '@cf/deepgram/aura-2-en': {
    name: 'Aura-2 English',
    contextLength: 0,
    neuronsPer1KTokens: 400,
    costPer1KNeurons: 0.0004,
    capabilities: ['audio', 'tts', 'speech', 'english'],
  },
  '@cf/deepgram/aura-2-es': {
    name: 'Aura-2 Spanish',
    contextLength: 0,
    neuronsPer1KTokens: 400,
    costPer1KNeurons: 0.0004,
    capabilities: ['audio', 'tts', 'speech', 'spanish'],
  },

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

  '@cf/openai/clip-vit-base-patch32': {
    name: 'CLIP ViT Base',
    contextLength: 77,
    neuronsPer1KTokens: 52,
    costPer1KNeurons: 0.0001,
    capabilities: ['embedding'],
  },
};


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

  private getAI(): WorkersAIBinding | null {
    return this.env.bindings?.AI || this.env.AI || null;
  }

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

    const modelInfo = MODELS[model];

    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    const inputs: Record<string, unknown> = {
      prompt: request.prompt,
      messages: request.messages,
      ...request.parameters,
    };

    if (!inputs.messages) {
      delete inputs.messages;
    }

    try {
      const response = await ai.run(model, inputs);

      const content = this.extractContent(response);
      const tokens = this.estimateTokens(content);

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

    return new ReadableStream<LLMStreamChunk>({
      async start(controller) {
        try {
          const inputs: Record<string, unknown> = {
            prompt: request.prompt,
            messages: request.messages,
            stream: true,
            ...request.parameters,
          };

          const response = await ai.run(model, inputs);
          const content = String(response || '');

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

  selectModel(requirements: ModelRequirements): string {
    const candidates = Object.entries(MODELS).filter(([_, info]) =>
      info.capabilities.includes(requirements.task)
    );

    if (candidates.length === 0) {
      throw new Error(`No models found for task: ${requirements.task}`);
    }

    let sorted = candidates;

    if (requirements.contextLength !== undefined) {
      sorted = sorted.filter(([_, info]) =>
        (info.contextLength ?? 0) >= requirements.contextLength!
      );
    }

    if (requirements.speed) {
      sorted.sort((a, b) => {
        const costA = a[1].costPer1KNeurons;
        const costB = b[1].costPer1KNeurons;
        return requirements.speed === 'fast'
          ? costA - costB
          : costB - costA;
      });
    }

    if (requirements.costSensitive) {
      sorted.sort((a, b) =>
        a[1].costPer1KNeurons - b[1].costPer1KNeurons
      );
    }

    return sorted[0]?.[0] || '@cf/meta/llama-3.1-8b-instruct';
  }

  trackNeuronUsage(model: string, tokens: number): number {
    const modelInfo = MODELS[model];
    if (!modelInfo) {
      return 0;
    }

    const neuronsPer1K = modelInfo.neuronsPer1KTokens;
    return Math.ceil((tokens / 1000) * neuronsPer1K);
  }

  calculateCost(model: string, neurons: number): number {
    const modelInfo = MODELS[model];
    if (!modelInfo) {
      return 0;
    }

    const costPer1KNeurons = modelInfo.costPer1KNeurons;
    return (neurons / 1000) * costPer1KNeurons;
  }

  getAvailableModels(): string[] {
    return Object.keys(MODELS);
  }

  getModelInfo(model: string): ModelInfo | null {
    return MODELS[model] || null;
  }


  async generateSpeech(
    text: string,
    options: {
      model?: string;
      lang?: string;
      returnRawResponse?: boolean;
      voice?: string;
      speed?: number;
      pitch?: number;
      emotion?: string;
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
      const params: Record<string, unknown> = {};

      if (model.includes('melotts')) {
        params.prompt = text;
        params.lang = options.lang || 'en';
      } else {
        params.text = text;
      }

      if (options.voice) {
        params.voice = options.voice;
      }

      if (options.speed !== undefined) {
        params.speed = Math.max(0.25, Math.min(4.0, options.speed));
      }

      if (options.pitch !== undefined) {
        params.pitch = Math.max(-20, Math.min(20, options.pitch));
      }

      if (options.emotion) {
        params.emotion = options.emotion;
      }

      const response = await ai.run(model, params);

      if (response instanceof ReadableStream) {
        const reader = response.getReader();
        const chunks: Uint8Array[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
        } catch (error) {
          try { await reader.cancel(); } catch {}
          throw error;
        }

        const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        const binary = Array.from(combined, byte => String.fromCharCode(byte)).join('');
        const base64 = btoa(binary);

        return {
          audio: base64,
          format: 'mp3',
          model,
        };
      }

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

  async generateBatchSpeech(
    texts: string[],
    options: {
      model?: string;
      lang?: string;
      parallel?: boolean;
      onProgress?: (index: number, total: number) => void;
    } = {}
  ): Promise<Array<{ audio: string; format: string; model: string; index: number }>> {
    const parallel = options.parallel !== false;
    const results: Array<{ audio: string; format: string; model: string; index: number }> = [];

    if (parallel) {
      const promises = texts.map((text, index) =>
        this.generateSpeech(text, options).then(result => {
          options.onProgress?.(index + 1, texts.length);
          return { ...result, index };
        })
      );
      return await Promise.all(promises);
    } else {
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (text === undefined) continue;
        const result = await this.generateSpeech(text, options);
        results.push({ ...result, index: i });
        options.onProgress?.(i + 1, texts.length);
      }
      return results;
    }
  }

  async generateSpeechWithProfile(
    text: string,
    profile: {
      model?: string;
      lang?: string;
      voice?: string;
      speed?: number;
      pitch?: number;
      emotion?: string;
    }
  ): Promise<{ audio: string; format: string; model: string }> {
    return this.generateSpeech(text, profile);
  }


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
      let audioInput: Record<string, unknown>;

      if (typeof audio === 'string') {
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
        audioInput = {
          audio: Array.from(new Uint8Array(audio)),
        };
      }

      if (options.detectLanguage) {
        audioInput.detect_language = options.detectLanguage;
      }

      if (options.language) {
        audioInput.language = options.language;
      }

      const response = await ai.run(model, audioInput);

      let text = '';
      let language: string | undefined;

      if (typeof response === 'string') {
        text = response;
      } else if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;

        if ('text' in r && typeof r.text === 'string') {
          text = r.text;
        }

        if ('language' in r && typeof r.language === 'string') {
          language = r.language;
        }

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

  getAvailableTTSModels(): string[] {
    return Object.entries(MODELS)
      .filter(([_, info]) => info.capabilities.includes('tts'))
      .map(([model, _]) => model);
  }

  getAvailableASRModels(): string[] {
    return Object.entries(MODELS)
      .filter(([_, info]) => info.capabilities.includes('asr'))
      .map(([model, _]) => model);
  }


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

  private tryParseJSON<T>(content: string): T | undefined {
    try {
      const trimmed = content.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed) as T;
      }
    } catch {
    }
    return undefined;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private generateId(): string {
    return generateId();
  }
}


export const workersAIService = new WorkersAIService({});
