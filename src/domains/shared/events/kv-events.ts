
import { DomainEvent } from './domain-event.base';

export class KVEntryCreatedEvent extends DomainEvent {
  constructor(
    public readonly key: string,
    public readonly value: unknown,
    public readonly namespace: string,
    public readonly ttl?: number
  ) {
    super();
  }

  getAggregateId(): string {
    return `kv:${this.namespace}:${this.key}`;
  }
}

export class KVEntryUpdatedEvent extends DomainEvent {
  constructor(
    public readonly key: string,
    public readonly oldValue: unknown,
    public readonly newValue: unknown,
    public readonly namespace: string
  ) {
    super();
  }

  getAggregateId(): string {
    return `kv:${this.namespace}:${this.key}`;
  }
}

export class KVEntryDeletedEvent extends DomainEvent {
  constructor(
    public readonly key: string,
    public readonly namespace: string
  ) {
    super();
  }

  getAggregateId(): string {
    return `kv:${this.namespace}:${this.key}`;
  }
}

export class KVCacheHitEvent extends DomainEvent {
  constructor(
    public readonly key: string,
    public readonly namespace: string,
    public readonly cacheLevel: 'L1' | 'L2'
  ) {
    super();
  }

  getAggregateId(): string {
    return `kv:${this.namespace}:${this.key}`;
  }
}

export class KVCacheMissEvent extends DomainEvent {
  constructor(
    public readonly key: string,
    public readonly namespace: string
  ) {
    super();
  }

  getAggregateId(): string {
    return `kv:${this.namespace}:${this.key}`;
  }
}
