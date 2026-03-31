/**
 * KV Domain Events
 * @description Events for KV storage operations
 */

import { DomainEvent } from './domain-event.base';

/**
 * KV Entry Created Event
 */
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

/**
 * KV Entry Updated Event
 */
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

/**
 * KV Entry Deleted Event
 */
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

/**
 * KV Cache Hit Event
 */
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

/**
 * KV Cache Miss Event
 */
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
