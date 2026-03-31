/**
 * AI Domain Events
 * @description Events for AI operations
 */

import { DomainEvent } from './domain-event.base';

/**
 * AI Response Cached Event
 */
export class AIResponseCachedEvent extends DomainEvent {
  constructor(
    public readonly key: string,
    public readonly model: string,
    public readonly tokens: number,
    public readonly tags: string[],
    public readonly ttl?: number
  ) {
    super();
  }

  getAggregateId(): string {
    return `ai:${this.key}`;
  }
}

/**
 * AI Cache Invalidated Event
 */
export class AICacheInvalidatedEvent extends DomainEvent {
  constructor(
    public readonly key: string,
    public readonly reason: 'manual' | 'ttl' | 'tag_invalidation'
  ) {
    super();
  }

  getAggregateId(): string {
    return `ai:${this.key}`;
  }
}

/**
 * AI Model Called Event
 */
export class AIModelCalledEvent extends DomainEvent {
  constructor(
    public readonly model: string,
    public readonly promptTokens: number,
    public readonly completionTokens: number,
    public readonly latency: number
  ) {
    super();
  }

  getAggregateId(): string {
    return `ai:model:${this.model}`;
  }
}

/**
 * AI Gateway Call Event
 * @description Generic event for any AI provider call through the gateway
 */
export class AIGatewayCallEvent extends DomainEvent {
  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly tokens: number,
    public readonly cost: number,
    public readonly latency: number,
    public readonly tags: string[] = []
  ) {
    super();
  }

  getAggregateId(): string {
    return `ai:gateway:${this.provider}:${this.model}`;
  }

  /**
   * Get cost per token
   */
  getCostPerToken(): number {
    return this.tokens > 0 ? this.cost / this.tokens : 0;
  }

  /**
   * Get tokens per second
   */
  getTokensPerSecond(): number {
    return this.latency > 0 ? (this.tokens / this.latency) * 1000 : 0;
  }
}
