import type {
  IAIGatewayService,
  IEmbeddingService,
} from '../types';
import type {
  AIGatewayConfig,
  AIRequest,
  AIResponse,
  AICostSummary,
  AIProvider,
  ProviderCallOptions,
  ProviderCallResult,
} from '../entities';
import type { WorkersAIBinding } from '../../../config/types';
import { generateId } from '../../../infrastructure/utils/helpers';

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}


export class AIGatewayService implements IAIGatewayService {
  private config: AIGatewayConfig;
  private kv?: KVNamespace;
  private embeddingService?: IEmbeddingService;
  private workersAI?: WorkersAIBinding;

  private costTracker: Map<string, number> = new Map();
  private costHistory: Array<{
    provider: string;
    model: string;
    neurons: number;
    cost: number;
    userId?: string;
    timestamp: number;
  }> = [];

  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  private analytics: Map<string, number> = new Map();

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000;
  private readonly MAX_COST_HISTORY = 1000;

  private accountId?: string;
  private gatewayId?: string;

  constructor(
    config: AIGatewayConfig,
    KV?: KVNamespace,
    embeddingService?: IEmbeddingService,
    workersAI?: WorkersAIBinding
  ) {
    this.config = config;
    this.kv = KV;
    this.embeddingService = embeddingService;
    this.workersAI = workersAI;

    const hfProvider = config.providers.find(p => this.isHuggingFaceProvider(p));
    if (hfProvider) {
      this.parseHuggingFaceGatewayURL(hfProvider.baseURL);
    }

    for (const provider of config.providers) {
      this.circuitBreakers.set(provider.id, {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
  }


  async callProvider<T = unknown>(
    provider: 'huggingface' | 'workers-ai' | 'openai' | 'anthropic' | 'cohere' | 'custom',
    model: string,
    payload: unknown,
    options?: ProviderCallOptions
  ): Promise<ProviderCallResult<T>> {
    const startTime = Date.now();

    const providerConfig = this.findProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Provider '${provider}' not configured`);
    }

    let url = providerConfig.baseURL;
    if (provider === 'huggingface') {
      url = this.buildHuggingFaceGatewayURL(
        model,
        options?.gatewayId || this.gatewayId || this.config.gatewayId
      );
    } else {
      url = `${providerConfig.baseURL}/${model}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (provider !== 'huggingface' && providerConfig.apiKey) {
      headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
    }

    try {
      const timeoutController = options?.timeout
        ? new AbortController()
        : undefined;
      const timer = options?.timeout
        ? setTimeout(() => timeoutController!.abort(), options.timeout)
        : undefined;

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: timeoutController?.signal,
        });
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }

      if (timeoutController?.signal.aborted) {
        throw new Error(`Provider ${provider} timed out after ${options?.timeout}ms`);
      }

      if (!response.ok) {
        throw new Error(`Provider error: ${response.status} ${response.statusText}`);
      }

      let data: T | Response;
      let tokens = 0;
      let cost = 0;

      if (options?.returnRawResponse) {
        data = response as T;
      } else {
        const responseType = options?.responseType || 'json';

        switch (responseType) {
          case 'json':
            data = await response.json() as T;
            break;
          case 'text':
            data = await response.text() as T;
            break;
          case 'arraybuffer':
            data = await response.arrayBuffer() as T;
            break;
          case 'blob':
            data = await response.blob() as T;
            break;
          default:
            data = await response.json() as T;
        }

        if (responseType === 'json' && typeof data === 'object') {
          tokens = this.estimateTokensFromData(data);
          cost = this.calculateCost(providerConfig, model, tokens);
        }
      }

      const latency = Date.now() - startTime;

      return {
        data,
        model,
        provider: providerConfig.id,
        tokens,
        cost,
        latency,
        cached: false,
        metadata: {
          accountId: this.accountId,
          gatewayId: options?.gatewayId || this.gatewayId,
        },
      };

    } catch (error) {
      throw new Error(
        `Provider ${provider} error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async callHuggingFace<T = unknown>(
    model: string,
    payload: unknown,
    options?: Omit<ProviderCallOptions, 'gatewayId'>
  ): Promise<ProviderCallResult<T>> {
    const gatewayId = this.gatewayId || this.config.gatewayId;
    return this.callProvider<T>('huggingface', model, payload, options ? {
      ...options,
      gatewayId,
    } : { gatewayId });
  }

  async callWorkersAI<T = unknown>(
    model: string,
    params: Record<string, unknown>,
    gateway?: {
      id?: string;
      skipCache?: boolean;
      cacheTtl?: number;
    }
  ): Promise<ProviderCallResult<T>> {
    const startTime = Date.now();

    if (!this.workersAI) {
      throw new Error(
        'Workers AI binding not configured. Pass WorkersAIBinding to constructor.'
      );
    }

    try {
      const inputs: Record<string, unknown> = { ...params };

      const options: Record<string, unknown> = {};
      if (gateway) {
        if (gateway.id) options.gateway = gateway.id;
        if (gateway.skipCache !== undefined) options.skipCache = gateway.skipCache;
        if (gateway.cacheTtl !== undefined) options.cacheTtl = gateway.cacheTtl;
      }

      const result = await this.workersAI.run<T>(model, inputs);

      const tokens = this.estimateTokensFromData(result);
      const cost = this.calculateCostFromModel(model, tokens);
      const latency = Date.now() - startTime;

      return {
        data: result,
        model,
        provider: 'workers-ai',
        tokens,
        cost,
        latency,
        cached: false,
        metadata: {
          gatewayId: gateway?.id,
          binding: true,
        },
      };

    } catch (error) {
      throw new Error(
        `Workers AI binding error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private calculateCostFromModel(model: string, tokens: number): number {
    const pricing: Record<string, number> = {
      '@cf/meta/llama-3.1-8b-instruct': 0.00015,
      '@cf/meta/llama-3.3-70b-instruct': 0.00045,
      '@cf/mistral/mistral-7b-instruct': 0.00015,
      '@hf/google/gemma-7b-it': 0.00015,
      '@cf/stabilityai/stable-diffusion-xl-base-1.0': 0.001,
    };

    const costPer1K = pricing[model] || 0.00015;
    return (tokens / 1000) * costPer1K;
  }


  buildHuggingFaceGatewayURL(model: string, gatewayId?: string): string {
    const accountId = this.accountId || '{account_id}';
    const gwId = gatewayId || this.gatewayId || this.config.gatewayId || '{gateway_id}';

    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gwId}/huggingface/${model}`;
  }

  private parseHuggingFaceGatewayURL(url: string): void {
    const match = url.match(/\/v1\/([^/]+)\/([^/]+)\/huggingface/);
    if (match) {
      this.accountId = match[1];
      this.gatewayId = match[2];
    }
  }

  private isHuggingFaceProvider(provider: AIProvider): boolean {
    return provider.baseURL.includes('/huggingface') ||
           provider.type === 'custom' && provider.name.toLowerCase().includes('huggingface');
  }

  private findProviderConfig(
    providerType: 'huggingface' | 'workers-ai' | 'openai' | 'anthropic' | 'cohere' | 'custom'
  ): AIProvider | null {
    return this.config.providers.find(p => {
      if (providerType === 'huggingface') {
        return this.isHuggingFaceProvider(p);
      }
      return p.type === providerType;
    }) || null;
  }


  async route(request: AIRequest): Promise<AIResponse> {

    if (this.config.cacheEnabled && request.cacheKey) {
      const cached = await this.getCached(request.cacheKey);
      if (cached) {
        this.trackAnalytics('cache_hit');
        return {
          ...cached,
          timestamp: Date.now(),
        };
      }
    }

    const provider = this.selectProvider(request.provider);
    if (!provider) {
      throw new Error(`Provider ${request.provider} not found`);
    }

    if (!this.isProviderAvailable(provider.id)) {
      if (provider.fallbackProvider) {
        const fallback = this.config.providers.find(p => p.id === provider.fallbackProvider);
        if (fallback && this.isProviderAvailable(fallback.id)) {
          return this.makeRequest(fallback, request);
        }
      }
      throw new Error(`Provider ${provider.id} is not available`);
    }

    try {
      const response = await this.makeRequest(provider, request);

      if (this.config.cacheEnabled && request.cacheKey) {
        await this.saveToCache(request.cacheKey, response);
      }

      if (this.config.analytics) {
        this.trackAnalytics(provider.id);
      }

      return response;

    } catch (error) {
      this.recordFailure(provider.id);

      if (provider.fallbackProvider) {
        const fallback = this.config.providers.find(p => p.id === provider.fallbackProvider);
        if (fallback && this.isProviderAvailable(fallback.id)) {
          return this.makeRequest(fallback, request);
        }
      }

      throw error;
    }
  }

  private async makeRequest(
    provider: AIProvider,
    request: AIRequest
  ): Promise<AIResponse> {
    const url = `${provider.baseURL}/${request.model}`;
    const neurons = this.estimateNeurons(request.prompt);

    try {
      let response: Response;

      if (provider.type === 'workers-ai') {
        const result = await this.callWorkersAI(
          request.model,
          {
            prompt: request.prompt,
            messages: request.messages,
            ...request.parameters,
          }
        );
        response = new Response(JSON.stringify(result.data), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            prompt: request.prompt,
            messages: request.messages,
            ...request.parameters,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`Provider error: ${response.statusText}`);
      }

      const data = await response.json() as Record<string, unknown>;

      const content = this.extractContent(data);

      const cost = this.calculateCost(provider, request.model, neurons);

      await this.trackCost({
        provider: provider.id,
        model: request.model,
        neurons,
        cost,
        userId: request.metadata?.userId as string | undefined,
      });

      return {
        id: this.generateId(),
        provider: provider.id,
        model: request.model,
        content,
        usage: {
          promptTokens: Math.floor(neurons * 0.3),
          completionTokens: Math.floor(neurons * 0.7),
          totalTokens: neurons * 2,
          neurons,
          cost,
        },
        cached: false,
        timestamp: Date.now(),
      };

    } catch (error) {
      throw new Error(
        `Provider ${provider.id} error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private selectProvider(providerId?: string): AIProvider | null {
    if (providerId) {
      return this.config.providers.find(p => p.id === providerId) || null;
    }

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

  async trackCost(data: {
    provider: string;
    model: string;
    neurons: number;
    cost: number;
    userId?: string;
  }): Promise<void> {
    const key = `${data.provider}:${data.model}`;
    const current = this.costTracker.get(key) || 0;
    this.costTracker.set(key, current + data.cost);

    this.costHistory.push({
      ...data,
      timestamp: Date.now(),
    });

    if (this.costHistory.length > this.MAX_COST_HISTORY) {
      this.costHistory.shift();
    }

    if (this.kv) {
      const periodKey = `cost:${Math.floor(Date.now() / 3600000)}`;
      try {
        await this.kv.put(periodKey, JSON.stringify(this.costHistory), {
          expirationTtl: 86400,
        });
      } catch (error) {
         
        console.warn('[AIGateway] Failed to persist cost history:', error);
      }
    }
  }

  async getCostSummary(_period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<AICostSummary> {
    const totalCost = Array.from(this.costTracker.values()).reduce((a, b) => a + b, 0);
    const totalNeurons = this.costHistory.reduce((sum, r) => sum + r.neurons, 0);

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const record of this.costHistory) {
      byProvider[record.provider] = (byProvider[record.provider] || 0) + record.cost;
      byModel[record.model] = (byModel[record.model] || 0) + record.cost;
    }

    return {
      totalCost,
      byProvider,
      byModel,
      totalNeurons,
      totalRequests: this.costHistory.length,
      avgCostPerRequest: this.costHistory.length > 0 ? totalCost / this.costHistory.length : 0,
    };
  }

  enforceBudget(budget: number, provider?: string): boolean {
    const summary = this.getCostSummaryFromMemory();

    if (provider) {
      const providerCost = summary.byProvider[provider] || 0;
      return providerCost < budget;
    }

    return summary.totalCost < budget;
  }

  async getCached(key: string): Promise<AIResponse | null> {
    if (!this.kv) {
      return null;
    }
    try {
      const data = await this.kv.get(`ai_cache:${key}`);
      return data ? (JSON.parse(data) as AIResponse) : null;
    } catch (error) {
       
      console.warn('[AIGateway] Cache read failed:', error);
      return null;
    }
  }

  async getCachedSemantic(
    embedding: number[],
    threshold: number = 0.9
  ): Promise<AIResponse | null> {
    if (!this.embeddingService || !this.kv) {
      return null;
    }

    try {
      const recentKeys = await this.getRecentCacheKeys(100);

      for (const key of recentKeys) {
        const cached = await this.getCached(key);
        if (cached && cached.metadata?.embedding) {
          const cachedEmbedding = cached.metadata.embedding as number[];
          const similarity = this.embeddingService.calculateSimilarity(embedding, cachedEmbedding);

          if (similarity >= threshold) {
            return cached;
          }
        }
      }

      return null;

    } catch (error) {
       
      console.warn('[AIGateway] Semantic cache lookup failed:', error);
      return null;
    }
  }

  async saveToCache(key: string, response: AIResponse): Promise<void> {
    if (!this.kv || !this.config.cacheTTL) {
      return;
    }
    try {
      await this.kv.put(
        `ai_cache:${key}`,
        JSON.stringify(response),
        { expirationTtl: this.config.cacheTTL }
      );
    } catch (error) {
       
      console.warn('[AIGateway] Cache write failed:', error);
    }
  }

  async getAnalytics(): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalNeurons: number;
    totalCost: number;
    cacheHitRate: number;
    providerUsage: Record<string, number>;
  }> {
    const totalRequests = Array.from(this.analytics.values()).reduce((a, b) => a + b, 0);
    const cacheHits = this.analytics.get('cache_hit') || 0;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    const costSummary = await this.getCostSummary();

    return {
      totalRequests,
      totalTokens: costSummary.totalNeurons * 2,
      totalNeurons: costSummary.totalNeurons,
      totalCost: costSummary.totalCost,
      cacheHitRate,
      providerUsage: Object.fromEntries(this.analytics),
    };
  }

  isProviderAvailable(provider: string): boolean {
    const state = this.circuitBreakers.get(provider);
    if (!state) {
      return true;
    }

    if (state.isOpen) {
      if (Date.now() >= state.nextAttemptTime) {
        state.isOpen = false;
        state.failureCount = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  resetCircuitBreaker(provider: string): void {
    const state = this.circuitBreakers.get(provider);
    if (state) {
      state.isOpen = false;
      state.failureCount = 0;
      state.lastFailureTime = 0;
      state.nextAttemptTime = 0;
    }
  }

  private recordFailure(provider: string): void {
    const state = this.circuitBreakers.get(provider);
    if (!state) {
      return;
    }

    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      state.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
    }
  }

  private trackAnalytics(key: string): void {
    const current = this.analytics.get(key) || 0;
    this.analytics.set(key, current + 1);
  }

  private async getRecentCacheKeys(_limit: number): Promise<string[]> {
    return [];
  }

  private getCostSummaryFromMemory(): AICostSummary {
    const totalCost = Array.from(this.costTracker.values()).reduce((a, b) => a + b, 0);
    const totalNeurons = this.costHistory.reduce((sum, r) => sum + r.neurons, 0);

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const record of this.costHistory) {
      byProvider[record.provider] = (byProvider[record.provider] || 0) + record.cost;
      byModel[record.model] = (byModel[record.model] || 0) + record.cost;
    }

    return {
      totalCost,
      byProvider,
      byModel,
      totalNeurons,
      totalRequests: this.costHistory.length,
      avgCostPerRequest: this.costHistory.length > 0 ? totalCost / this.costHistory.length : 0,
    };
  }

  private extractContent(data: Record<string, unknown>): string {
    return String(
      data.content || data.response || data.output || data.text || data.message || ''
    );
  }

  private estimateNeurons(text: string): number {
    const tokens = Math.ceil(text.length / 4);
    return Math.ceil((tokens / 1000) * 208);
  }

  private estimateTokensFromData(data: unknown): number {
    if (typeof data === 'string') {
      return Math.ceil(data.length / 4);
    }
    if (typeof data === 'object' && data !== null) {
      const str = JSON.stringify(data);
      return Math.ceil(str.length / 4);
    }
    return 0;
  }

  private calculateCost(provider: AIProvider, model: string, neurons: number): number {
    const pricing = provider.pricing?.[model];

    if (pricing) {
      if (pricing.neuronsPer1KTokens) {
        return (neurons / pricing.neuronsPer1KTokens) * (pricing.costPer1KNeurons ?? 0);
      }
      return (neurons / 1000) * (pricing.costPer1KNeurons ?? 0);
    }

    return (neurons / 1000) * 0.00015;
  }

  private generateId(): string {
    return generateId();
  }
}


export function createAIGatewayService(
  config: AIGatewayConfig,
  KV?: KVNamespace,
  embeddingService?: IEmbeddingService,
  workersAI?: WorkersAIBinding
): AIGatewayService {
  return new AIGatewayService(config, KV, embeddingService, workersAI);
}

export const aiGatewayService = new AIGatewayService({
  gatewayId: 'default',
  providers: [],
  cacheEnabled: true,
  cacheTTL: 3600,
  rateLimiting: true,
  analytics: true,
});
