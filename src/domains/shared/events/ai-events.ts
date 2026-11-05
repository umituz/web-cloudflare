
import { DomainEvent } from './domain-event.base';

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

  getCostPerToken(): number {
    return this.tokens > 0 ? this.cost / this.tokens : 0;
  }

  getTokensPerSecond(): number {
    return this.latency > 0 ? (this.tokens / this.latency) * 1000 : 0;
  }
}
