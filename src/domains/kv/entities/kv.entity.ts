/**
 * KV Entity
 * @description Basic KV entity placeholder
 */

export interface KVEntity {
  namespaceId: string;
  key: string;
  value: string;
}

export interface KVNamespaceConfig {
  id: string;
  ttl?: number;
}

export interface KVEntry {
  key: string;
  value: string;
  metadata?: Record<string, unknown>;
}

export interface KVListOptions {
  limit?: number;
  cursor?: string;
  prefix?: string;
}

export interface KVListResult {
  keys: KVEntry[];
  cursor?: string;
}

export interface KVKey {
  name: string;
  metadata?: Record<string, unknown>;
}
