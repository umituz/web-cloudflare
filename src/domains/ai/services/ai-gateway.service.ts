/**
 * AI Gateway Service
 * @description Multi-provider routing with caching, fallback, and cost tracking
 */

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
} from '../entities';
import type { WorkersAIBinding } from '../../../config/types';

// ============================================================
// Circuit Breaker State
// ============================================================

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

// ============================================================
// AI Gateway Service Implementation
// ============================================================

export class AIGatewayService implements IAIGatewayService {
  private config: AIGatewayConfig;
  private kv?: KVNamespace;
  private embeddingService?: IEmbeddingService;

  // Cost tracking
  private costTracker: Map<string, number> = new Map();
  private costHistory: Array<{
    provider: string;
    model: string;
    neurons: number;
    cost: number;
    userId?: string;
    timestamp: number;
  }> = [];

  // Circuit breakers
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  // Analytics
  private analytics: Map<string, number> = new Map();

  // Configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly MAX_COST_HISTORY = 1000;

  constructor(config: AIGatewayConfig, KV?: KVNamespace, embeddingService?: IEmbeddingService) {
    this.config = config;
    this.kv = KV;
    this.embeddingService = embeddingService;

    // Initialize circuit breakers for all providers
    for (const provider of config.providers) {
      this.circuitBreakers.set(provider.id, {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
  }

  /**
   * Route AI request to appropriate provider
   */
  async route(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    // Check cache first
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

    // Select provider
    const provider = this.selectProvider(request.provider);
    if (!provider) {
      throw new Error(`Provider ${request.provider} not found`);
    }

    // Check circuit breaker
    if (!this.isProviderAvailable(provider.id)) {
      // Try fallback
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

      // Cache response
      if (this.config.cacheEnabled && request.cacheKey) {
        await this.saveToCache(request.cacheKey, response);
      }

      // Track analytics
      if (this.config.analytics) {
        this.trackAnalytics(provider.id);
      }

      return response;

    } catch (error) {
      // Record failure
      this.recordFailure(provider.id);

      // Try fallback
      if (provider.fallbackProvider) {
        const fallback = this.config.providers.find(p => p.id === provider.fallbackProvider);
        if (fallback && this.isProviderAvailable(fallback.id)) {
          return this.makeRequest(fallback, request);
        }
      }

      throw error;
    }
  }

  /**
   * Make request to provider
   */
  private async makeRequest(
    provider: AIProvider,
    request: AIRequest
  ): Promise<AIResponse> {
    const url = `${provider.baseURL}/${request.model}`;
    const neurons = this.estimateNeurons(request.prompt);

    try {
      let response: Response;

      if (provider.type === 'workers-ai') {
        // Use Workers AI binding
        response = await this.callWorkersAI(provider, request);
      } else {
        // Use HTTP API
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

      // Extract content
      const content = this.extractContent(data);

      // Calculate cost
      const cost = this.calculateCost(provider, request.model, neurons);

      // Track cost
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

  /**
   * Call Workers AI provider
   */
  private async callWorkersAI(
    provider: AIProvider,
    request: AIRequest
  ): Promise<Response> {
    // Note: This would use actual Workers AI binding
    // For now, return a mock response
    return new Response(JSON.stringify({
      response: 'Workers AI response',
    }));
  }

  /**
   * Select provider by ID or load balancing
   */
  private selectProvider(providerId?: string): AIProvider | null {
    if (providerId) {
      return this.config.providers.find(p => p.id === providerId) || null;
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
   * Track AI call cost
   */
  async trackCost(data: {
    provider: string;
    model: string;
    neurons: number;
    cost: number;
    userId?: string;
  }): Promise<void> {
    // Update in-memory tracker
    const key = `${data.provider}:${data.model}`;
    const current = this.costTracker.get(key) || 0;
    this.costTracker.set(key, current + data.cost);

    // Add to history
    this.costHistory.push({
      ...data,
      timestamp: Date.now(),
    });

    // Trim history if needed
    if (this.costHistory.length > this.MAX_COST_HISTORY) {
      this.costHistory.shift();
    }

    // Persist to KV if available
    if (this.kv) {
      try {
        const periodKey = `cost:${Math.floor(Date.now() / 3600000)}`; // Hourly
        await this.kv.put(periodKey, JSON.stringify(this.costHistory), {
          expirationTtl: 86400, // 24 hours
        });
      } catch {
        // Silently fail - cost tracking shouldn't break the app
      }
    }
  }

  /**
   * Get cost summary
   */
  async getCostSummary(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<AICostSummary> {
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

  /**
   * Enforce budget limit
   */
  enforceBudget(budget: number, provider?: string): boolean {
    const summary = this.getCostSummaryFromMemory();

    if (provider) {
      const providerCost = summary.byProvider[provider] || 0;
      return providerCost < budget;
    }

    return summary.totalCost < budget;
  }

  /**
   * Get cached response (exact match)
   */
  async getCached(key: string): Promise<AIResponse | null> {
    if (this.kv) {
      try {
        const data = await this.kv.get(`ai_cache:${key}`);
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Get cached response (semantic match)
   */
  async getCachedSemantic(
    embedding: number[],
    threshold: number = 0.9
  ): Promise<AIResponse | null> {
    // Requires embedding service for semantic matching
    if (!this.embeddingService || !this.kv) {
      return null;
    }

    try {
      // Get recent cache keys
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

    } catch {
      return null;
    }
  }

  /**
   * Save response to cache
   */
  async saveToCache(key: string, response: AIResponse): Promise<void> {
    if (this.kv && this.config.cacheTTL) {
      try {
        await this.kv.put(
          `ai_cache:${key}`,
          JSON.stringify(response),
          { expirationTtl: this.config.cacheTTL }
        );
      } catch {
        // Silently fail
      }
    }
  }

  /**
   * Get analytics
   */
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

  /**
   * Check circuit breaker
   */
  isProviderAvailable(provider: string): boolean {
    const state = this.circuitBreakers.get(provider);
    if (!state) {
      return true;
    }

    if (state.isOpen) {
      // Check if timeout has elapsed
      if (Date.now() >= state.nextAttemptTime) {
        // Reset circuit breaker
        state.isOpen = false;
        state.failureCount = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(provider: string): void {
    const state = this.circuitBreakers.get(provider);
    if (state) {
      state.isOpen = false;
      state.failureCount = 0;
      state.lastFailureTime = 0;
      state.nextAttemptTime = 0;
    }
  }

  /**
   * Record failure
   */
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

  /**
   * Track analytics
   */
  private trackAnalytics(key: string): void {
    const current = this.analytics.get(key) || 0;
    this.analytics.set(key, current + 1);
  }

  /**
   * Get recent cache keys
   */
  private async getRecentCacheKeys(limit: number): Promise<string[]> {
    // This would require KV list support
    // For now, return empty array
    return [];
  }

  /**
   * Get cost summary from memory
   */
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

  /**
   * Extract content from response
   */
  private extractContent(data: Record<string, unknown>): string {
    return String(
      data.content || data.response || data.output || data.text || data.message || ''
    );
  }

  /**
   * Estimate neurons from text
   */
  private estimateNeurons(text: string): number {
    // Rough estimate: ~4 characters per token, ~208 neurons per 1K tokens for Llama
    const tokens = Math.ceil(text.length / 4);
    return Math.ceil((tokens / 1000) * 208);
  }

  /**
   * Calculate cost for provider and model
   */
  private calculateCost(provider: AIProvider, model: string, neurons: number): number {
    const pricing = provider.pricing?.[model];

    if (pricing) {
      if (pricing.neuronsPer1KTokens) {
        return (neurons / pricing.neuronsPer1KTokens) * (pricing.costPer1KNeurons ?? 0);
      }
      return (neurons / 1000) * (pricing.costPer1KNeurons ?? 0);
    }

    // Default pricing
    return (neurons / 1000) * 0.00015;
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

export const aiGatewayService = new AIGatewayService({
  gatewayId: 'default',
  providers: [],
  cacheEnabled: true,
  cacheTTL: 3600,
  rateLimiting: true,
  analytics: true,
});
