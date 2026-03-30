/**
 * KV Service
 * @description Cloudflare KV key-value storage operations with AI response caching and hierarchical L1/L2 caching
 */

import type { KVEntry, KVListOptions, KVListResult } from "../../../domain/entities/kv.entity";
import type { IKVService } from "../../../domain/interfaces/services.interface";
import type { AIResponse } from "../../ai/entities";
import { validationUtils, cacheUtils } from "../../../infrastructure/utils";

// ============================================================
// LRU Cache for L1 Memory Cache
// ============================================================

class LRUCache<T> {
  private cache: Map<string, { value: T; expires: number }>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check expiration
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key: string, value: T, ttl: number): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================================
// KV Cache Options
// ============================================================

export interface KVCacheOptions {
  readonly namespace: string;
  readonly defaultTTL?: number;
  readonly l1CacheSize?: number;
  readonly enableL1Cache?: boolean;
}

// ============================================================
// AI Response Cache Types
// ============================================================

export interface AIResponseCacheOptions {
  readonly ttl?: number;
  readonly binding?: string;
  readonly tags?: string[];
}

export class KVService implements IKVService {
  private namespaces: Map<string, KVNamespace> = new Map();
  private defaultTTL: number = 3600;
  private l1Cache: LRUCache<unknown>;
  private enableL1Cache: boolean;

  constructor() {
    this.l1Cache = new LRUCache(1000);
    this.enableL1Cache = true;
  }

  initialize(options: KVCacheOptions): void {
    // Namespaces are bound by Cloudflare at runtime
    // This is just a reference to the binding name
    this.defaultTTL = options.defaultTTL ?? 3600;
    this.enableL1Cache = options.enableL1Cache ?? true;

    if (options.l1CacheSize) {
      this.l1Cache = new LRUCache(options.l1CacheSize);
    }
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

  // ============================================================
  // Hierarchical Caching (L1 Memory + L2 KV)
  // ============================================================

  /**
   * Get with hierarchical caching (L1 → L2)
   */
  async getWithCache<T>(
    key: string,
    options?: { ttl?: number; binding?: string }
  ): Promise<T | null> {
    // Check L1 (memory) cache first
    if (this.enableL1Cache) {
      const l1Value = this.l1Cache.get(key) as T | null;
      if (l1Value !== null) {
        return l1Value;
      }
    }

    // Check L2 (KV) cache
    const value = await this.get<T>(key, options?.binding);

    // Store in L1 if found in L2
    if (value !== null && this.enableL1Cache) {
      this.l1Cache.set(key, value, options?.ttl ?? this.defaultTTL);
    }

    return value;
  }

  /**
   * Put with hierarchical caching
   */
  async putWithCache<T>(
    key: string,
    value: T,
    options?: { ttl?: number; binding?: string }
  ): Promise<void> {
    // Store in L1 (memory)
    if (this.enableL1Cache) {
      this.l1Cache.set(key, value, options?.ttl ?? this.defaultTTL);
    }

    // Store in L2 (KV)
    await this.put(key, value, options);
  }

  // ============================================================
  // AI Response Caching
  // ============================================================

  /**
   * Cache AI response with metadata
   */
  async cacheAIResponse(
    key: string,
    response: AIResponse,
    options?: AIResponseCacheOptions
  ): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTTL;
    const tags = options?.tags || [];

    // Store with metadata
    const cacheValue = {
      ...response,
      _tags: tags,
      _cachedAt: Date.now(),
    };

    await this.put(`ai:${key}`, cacheValue, { ttl, binding: options?.binding });

    // Also store tagged indexes for invalidation
    for (const tag of tags) {
      const tagKey = `ai:tag:${tag}`;
      const taggedKeys = (await this.get<string[]>(tagKey, options?.binding)) || [];
      taggedKeys.push(key);
      await this.put(tagKey, taggedKeys, { ttl: ttl * 2, binding: options?.binding });
    }
  }

  /**
   * Get cached AI response
   */
  async getCachedAIResponse(
    key: string,
    binding?: string
  ): Promise<AIResponse | null> {
    const cached = await this.get<AIResponse>(`ai:${key}`, binding);
    return cached;
  }

  /**
   * Invalidate AI cache by tag
   */
  async invalidateTagged(tag: string, binding?: string): Promise<void> {
    const tagKey = `ai:tag:${tag}`;
    const taggedKeys = await this.get<string[]>(tagKey, binding);

    if (!taggedKeys) return;

    // Delete all cached responses with this tag
    for (const key of taggedKeys) {
      await this.delete(`ai:${key}`, binding);
    }

    // Delete the tag index
    await this.delete(tagKey, binding);
  }

  // ============================================================
  // Intelligent Cache Invalidation
  // ============================================================
  // Cache Warming
  // ============================================================

  /**
   * Warm cache with predefined entries
   */
  async warmCache(
    entries: Array<{
      key: string;
      value: unknown;
      ttl?: number;
    }>,
    binding?: string
  ): Promise<void> {
    // Warm L1 cache
    if (this.enableL1Cache) {
      for (const entry of entries) {
        this.l1Cache.set(entry.key, entry.value, entry.ttl ?? this.defaultTTL);
      }
    }

    // Warm L2 cache (KV) in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(entry =>
          this.put(entry.key, entry.value, { ttl: entry.ttl, binding })
        )
      );
    }
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
    // Clear from L1 cache as well
    if (this.enableL1Cache) {
      // Clean up expired entries
      this.l1Cache.cleanup();
    }

    const BATCH_SIZE = 100; // Process in batches to avoid overwhelming KV
    let cursor: string | undefined;

    do {
      const list = await this.list({ prefix, binding, limit: BATCH_SIZE, cursor });

      // Delete entries in batches (faster than sequential)
      await Promise.all(
        list.keys.map((key) => {
          // Also remove from L1 cache
          if (this.enableL1Cache) {
            this.l1Cache.delete(key.key);
          }
          return this.delete(key.key, binding);
        })
      );

      cursor = list.cursor;
    } while (cursor); // Continue until there are no more entries
  }

  // ============================================================
  // Cache Statistics and Management
  // ============================================================

  /**
   * Get cache statistics
   */
  async getCacheStats(binding?: string): Promise<{
    l1Size: number;
    l1Hits: number;
    l1HitRate: number;
  }> {
    // Clean up expired entries
    if (this.enableL1Cache) {
      this.l1Cache.cleanup();
    }

    return {
      l1Size: this.l1Cache.size,
      l1Hits: 0, // Would need to track hits
      l1HitRate: 0,
    };
  }

  /**
   * Clear all L1 cache entries
   */
  clearL1Cache(): void {
    this.l1Cache.clear();
  }

  /**
   * Cleanup expired entries from L1 cache
   */
  cleanupL1Cache(): number {
    return this.l1Cache.cleanup();
  }
}

// Export singleton instance
export const kvService = new KVService();
