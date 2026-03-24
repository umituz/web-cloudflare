/**
 * KV Service
 * @description Cloudflare KV key-value storage operations
 */

import type { KVEntry, KVListOptions, KVListResult } from "../../../domain/entities/kv.entity";
import type { IKVService } from "../../../domain/interfaces/services.interface";
import { validationUtils, cacheUtils } from "../../../infrastructure/utils";

export interface KVCacheOptions {
  readonly namespace: string;
  readonly defaultTTL?: number;
}

class KVService implements IKVService {
  private namespaces: Map<string, KVNamespace> = new Map();
  private defaultTTL: number = 3600;

  initialize(options: KVCacheOptions): void {
    // Namespaces are bound by Cloudflare at runtime
    // This is just a reference to the binding name
    this.defaultTTL = options.defaultTTL ?? 3600;
  }

  bindNamespace(name: string, namespace: KVNamespace): void {
    this.namespaces.set(name, namespace);
  }

  private getNamespace(binding?: string): KVNamespace {
    const name = binding || "default";
    const namespace = this.namespaces.get(name);
    if (!namespace) {
      throw new Error(`KV namespace "${name}" not bound`);
    }
    return namespace;
  }

  async get<T>(key: string, binding?: string): Promise<T | null> {
    if (!validationUtils.isValidKVKey(key)) {
      throw new Error(`Invalid KV key: ${key}`);
    }

    const namespace = this.getNamespace(binding);
    const value = await namespace.get(key, "json");

    return (value as T) ?? null;
  }

  async put<T>(key: string, value: T, options?: { ttl?: number; binding?: string }): Promise<void> {
    if (!validationUtils.isValidKVKey(key)) {
      throw new Error(`Invalid KV key: ${key}`);
    }

    const namespace = this.getNamespace(options?.binding);
    const ttl = options?.ttl ?? this.defaultTTL;

    await namespace.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  }

  async delete(key: string, binding?: string): Promise<boolean> {
    if (!validationUtils.isValidKVKey(key)) {
      throw new Error(`Invalid KV key: ${key}`);
    }

    const namespace = this.getNamespace(binding);
    await namespace.delete(key);

    return true;
  }

  async list(options?: KVListOptions & { binding?: string }): Promise<KVListResult> {
    const namespace = this.getNamespace(options?.binding);
    const list = await namespace.list({
      limit: options?.limit,
      cursor: options?.cursor,
      prefix: options?.prefix,
    });

    // Handle cursor property which may not be in the type definition
    type ListResultWithCursor = typeof list & { cursor?: string };
    const cursor = (list as ListResultWithCursor).cursor;

    return {
      keys: list.keys.map((k) => ({
        key: k.name,
        value: '',
        metadata: k.metadata as Record<string, unknown> | undefined,
      })),
      cursor: cursor,
    };
  }

  /**
   * Cache helpers
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: { ttl?: number; binding?: string }
  ): Promise<T> {
    const cached = await this.get<T>(key, options?.binding);
    if (cached !== null) return cached;

    const value = await factory();
    await this.put(key, value, options);

    return value;
  }

  /**
   * Invalidate cache entries matching a pattern
   * Optimized to process in batches for better performance
   */
  async invalidatePattern(prefix: string, binding?: string): Promise<void> {
    const BATCH_SIZE = 100; // Process in batches to avoid overwhelming KV
    let cursor: string | undefined;

    do {
      const list = await this.list({ prefix, binding, limit: BATCH_SIZE, cursor });

      // Delete entries in batches (faster than sequential)
      await Promise.all(
        list.keys.map((key) => this.delete(key.key, binding))
      );

      cursor = list.cursor;
    } while (cursor); // Continue until there are no more entries
  }
}

// Export class and singleton instance
export { KVService };
export const kvService = new KVService();
