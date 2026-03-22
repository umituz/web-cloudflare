/**
 * KV Entity
 * @description Cloudflare KV configuration and types
 */

export interface KVNamespaceConfig {
  readonly namespace: string;
  readonly ttl?: number;
}

export interface KVEntry<T = unknown> {
  readonly key: string;
  readonly value: T;
  readonly metadata?: Record<string, unknown>;
  readonly expiration?: number;
}

export interface KVListOptions {
  readonly limit?: number;
  readonly cursor?: string;
  readonly prefix?: string;
}

export interface KVListResult {
  readonly keys: readonly KVKey[];
  readonly list_complete: boolean;
  readonly cursor?: string;
}

export interface KVKey {
  readonly name: string;
  readonly metadata?: Record<string, unknown>;
  readonly expiration?: number;
}
