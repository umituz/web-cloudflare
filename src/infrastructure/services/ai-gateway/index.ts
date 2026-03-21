/**
 * Cloudflare AI Gateway Service
 * @description AI Gateway for routing, caching, and analytics
 */

import type {
  AIGatewayConfig,
  AIRequest,
  AIResponse,
  AIProvider,
  AIAnalytics,
} from '../../domain/ai-gateway.entity';

export class AIGatewayService {
  private config: AIGatewayConfig;
  private kv?: KVNamespace;
  private analytics: Map<string, number>;

  constructor(config: AIGatewayConfig, KV?: KVNamespace) {
    this.config = config;
    this.kv = KV;
    this.analytics = new Map();
  }

  /**
   * Route AI request to appropriate provider
   */
  async route(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    // Check cache first
    if (this.config.cacheEnabled && request.cacheKey) {
      const cached = await this.getFromCache(request.cacheKey);
      if (cached) {
        return {
          ...cached,
          cached: true,
          timestamp: Date.now(),
        };
      }
    }

    // Select provider (load balancing or fallback)
    const provider = this.selectProvider(request.provider);
    if (!provider) {
      throw new Error(`Provider ${request.provider} not found`);
    }

    try {
      // Make request to provider
      const response = await this.makeRequest(provider, request);

      // Cache response
      if (this.config.cacheEnabled && request.cacheKey) {
        await this.saveToCache(request.cacheKey, response);
      }

      // Track analytics
      if (this.config.analytics) {
        this.trackAnalytics(provider, response, Date.now() - startTime);
      }

      return response;

    } catch (error) {
      // Try fallback provider
      if (provider.fallbackProvider) {
        const fallback = this.config.providers.find(
          (p) => p.id === provider.fallbackProvider
        );
        if (fallback) {
          return this.makeRequest(fallback, request);
        }
      }
      throw error;
    }
  }

  /**
   * Select provider based on weight or specific provider
   */
  private selectProvider(providerId?: string): AIProvider | null {
    if (providerId) {
      return this.config.providers.find((p) => p.id === providerId) || null;
    }

    // Load balancing based on weights
    const totalWeight = this.config.providers.reduce(
      (sum, p) => sum + (p.weight || 1),
      0
    );
    let random = Math.random() * totalWeight;

    for (const provider of this.config.providers) {
      random -= provider.weight || 1;
      if (random <= 0) {
        return provider;
      }
    }

    return this.config.providers[0] || null;
  }

  /**
   * Make request to AI provider
   */
  private async makeRequest(
    provider: AIProvider,
    request: AIRequest
  ): Promise<AIResponse> {
    const url = `${provider.baseURL}/${request.model}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        ...request.parameters,
        stream: request.stream,
      }),
    });

    if (!response.ok) {
      throw new Error(`Provider error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      id: data.id || this.generateId(),
      provider: provider.id,
      model: request.model,
      content: data.content || data.text || data.output,
      usage: data.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      cached: false,
      timestamp: Date.now(),
    };
  }

  /**
   * Get response from cache
   */
  private async getFromCache(key: string): Promise<AIResponse | null> {
    if (this.kv) {
      const data = await this.kv.get(`ai_cache:${key}`);
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  /**
   * Save response to cache
   */
  private async saveToCache(key: string, response: AIResponse): Promise<void> {
    if (this.kv && this.config.cacheTTL) {
      await this.kv.put(
        `ai_cache:${key}`,
        JSON.stringify(response),
        { expirationTtl: this.config.cacheTTL }
      );
    }
  }

  /**
   * Track analytics
   */
  private trackAnalytics(
    provider: AIProvider,
    response: AIResponse,
    duration: number
  ): void {
    const key = `provider:${provider.id}`;
    const currentCount = this.analytics.get(key) || 0;
    this.analytics.set(key, currentCount + 1);
  }

  /**
   * Get analytics
   */
  async getAnalytics(): Promise<AIAnalytics> {
    return {
      totalRequests: Array.from(this.analytics.values()).reduce((a, b) => a + b, 0),
      totalTokens: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      providerUsage: Object.fromEntries(this.analytics),
      errorRate: 0,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Workers AI Service
 * @description Direct integration with Cloudflare Workers AI
 */

import type {
  WorkersAIRequest,
  WorkersAIResponse,
  WorkersAIInputs,
  ScriptGenerationRequest,
  EmotionControl,
} from '../../domain/ai-gateway.entity';

export class WorkersAIService {
  private env: {
    AI?: AiTextGeneration;
    bindings?: {
      AI?: Ai;
    };
  };

  constructor(env: { AI?: any; bindings?: any }) {
    this.env = env;
  }

  /**
   * Run text generation model
   */
  async runTextGeneration(
    model: string,
    inputs: WorkersAIInputs['text_generation']
  ): Promise<WorkersAIResponse> {
    try {
      // @ts-ignore - Workers AI runtime binding
      const ai = this.env.bindings?.AI || this.env.AI;

      if (!ai) {
        throw new Error('Workers AI binding not configured');
      }

      const response = await ai.run(model, inputs);

      return {
        success: true,
        data: {
          output: response.response || response.output || response.text,
        },
        model,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        model,
      };
    }
  }

  /**
   * Generate script with emotion control (from voice cloning app)
   */
  async generateScript(request: ScriptGenerationRequest): Promise<WorkersAIResponse> {
    const { topic, emotion, duration, style = 'casual', keywords = [] } = request;

    // Build emotion-enhanced prompt
    const emotionPrompt = this.buildEmotionPrompt(emotion);
    const keywordText = keywords.length > 0 ? `\nKeywords: ${keywords.join(', ')}` : '';
    const durationEstimate = Math.ceil(duration / 150); // ~150 words per minute

    const prompt = `Write a ${style} ${durationEstimate}-minute script about: ${topic}

${emotionPrompt}

Requirements:
- Duration: approximately ${duration} seconds
- Tone: ${style}
- Target: Engaging, clear, and natural
- Format: Conversational speech${keywordText}

Generate the script:`;

    return this.runTextGeneration('@cf/meta/llama-3.1-8b-instruct', {
      prompt,
      max_tokens: durationEstimate * 50,
      temperature: 0.8 + (emotion.intensity * 0.2),
      top_p: 0.9,
    });
  }

  /**
   * Build emotion prompt for script generation
   */
  private buildEmotionPrompt(emotion: EmotionControl): string {
    const intensityText =
      emotion.intensity > 0.7 ? 'strongly ' :
      emotion.intensity > 0.4 ? 'moderately ' :
      'subtly ';

    const emotionInstructions: Record<EmotionControl['emotion'], string> = {
      neutral: 'Maintain a balanced, professional tone throughout',
      happy: `Inject ${intensityText}positive, energetic language and enthusiastic expressions`,
      sad: `Use ${intensityText}reflective, thoughtful language with a gentle tone`,
      angry: `Incorporate ${intensityText}passionate, firm language with strong conviction`,
      excited: `Use ${intensityText}dynamic, upbeat language with high energy expressions`,
      calm: `Maintain ${intensityText}serene, peaceful language with a steady rhythm`,
      surprised: `Include ${intensityText}wonder, discovery, and unexpected insights`,
    };

    return emotionInstructions[emotion.emotion] || emotionInstructions.neutral;
  }

  /**
   * Run image generation model
   */
  async runImageGeneration(
    model: string,
    inputs: WorkersAIInputs['image_generation']
  ): Promise<WorkersAIResponse> {
    try {
      // @ts-ignore - Workers AI runtime binding
      const ai = this.env.bindings?.AI || this.env.AI;

      if (!ai) {
        throw new Error('Workers AI binding not configured');
      }

      const response = await ai.run(model, inputs);

      return {
        success: true,
        data: {
          image: response.image || response.output,
        },
        model,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        model,
      };
    }
  }

  /**
   * Generate embedding
   */
  async generateEmbedding(text: string): Promise<WorkersAIResponse> {
    try {
      // @ts-ignore - Workers AI runtime binding
      const ai = this.env.bindings?.AI || this.env.AI;

      if (!ai) {
        throw new Error('Workers AI binding not configured');
      }

      const model = '@cf/openai/clip-vit-base-patch32';
      const response = await ai.run(model, { text });

      return {
        success: true,
        data: {
          embedding: response.embedding || response.output,
        },
        model,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        model: '@cf/openai/clip-vit-base-patch32',
      };
    }
  }

  /**
   * Translate text
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<WorkersAIResponse> {
    try {
      // @ts-ignore - Workers AI runtime binding
      const ai = this.env.bindings?.AI || this.env.AI;

      if (!ai) {
        throw new Error('Workers AI binding not configured');
      }

      // Note: Translation model might vary
      const response = await ai.run('@cf/meta/m2m100-1.2b', {
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
      });

      return {
        success: true,
        data: {
          output: response.translated_text || response.output || response.text,
        },
        model: '@cf/meta/m2m100-1.2b',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        model: '@cf/meta/m2m100-1.2b',
      };
    }
  }
}
