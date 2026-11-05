
import type { KVListOptions, KVListResult } from "../entities";
import type { IKVService } from "../types/service.interface";
import type { AIResponse } from "../../ai/entities";
import type { IKVValidator } from "../interfaces/kv-validator.interface";

const DEFAULT_TTL_SECONDS = 3600;


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

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key: string, value: T, ttl: number): void {
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


export interface KVCacheOptions {
  readonly namespace: string;
  readonly defaultTTL?: number;
  readonly l1CacheSize?: number;
  readonly enableL1Cache?: boolean;
}


export interface AIResponseCacheOptions {
  readonly ttl?: number;
  readonly binding?: string;
  readonly tags?: string[];
}

export class KVService implements IKVService {
  private namespaces: Map<string, KVNamespace> = new Map();
  private defaultTTL: number = DEFAULT_TTL_SECONDS;
  private l1Cache: LRUCache<unknown>;
  private enableL1Cache: boolean;
  private validator: IKVValidator;

  constructor(validator?: IKVValidator) {
    this.l1Cache = new LRUCache(1000);
    this.enableL1Cache = true;
    this.defaultTTL = DEFAULT_TTL_SECONDS;
    this.validator = validator || this.createDefaultValidator();
  }

  private createDefaultValidator(): IKVValidator {
    return {
      isValidKey: (key: string) => {
        if (!key || key.trim().length === 0) return false;
        if (key.length > 512) return false;
        return /^[a-zA-Z0-9:_\-./]+$/.test(key);
      },
      validate: (input: string) => {
        if (!input || input.trim().length === 0) return false;
        if (input.length > 512) return false;
        return /^[a-zA-Z0-9:_\-./]+$/.test(input);
      },
      errorMessage: 'Invalid KV key format'
    };
  }

  initialize(options: KVCacheOptions): void {
    this.defaultTTL = options.defaultTTL ?? DEFAULT_TTL_SECONDS;
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
    if (!this.validator.isValidKey(key)) {
      throw new Error(`Invalid KV key: ${key}`);
    }

    const namespace = this.getNamespace(binding);
    const value = await namespace.get(key, "json");

    return (value as T) ?? null;
  }

  async put<T>(key: string, value: T, options?: { ttl?: number; binding?: string }): Promise<void> {
    if (!this.validator.isValidKey(key)) {
      throw new Error(`Invalid KV key: ${key}`);
    }

    const namespace = this.getNamespace(options?.binding);
    const ttl = options?.ttl ?? this.defaultTTL;

    await namespace.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  }

  async delete(key: string, binding?: string): Promise<boolean> {
    if (!this.validator.isValidKey(key)) {
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

    const cursor = (list as { cursor?: string }).cursor;

    return {
      keys: list.keys.map((k) => ({
        key: k.name,
        value: '',
        metadata: k.metadata as Record<string, unknown> | undefined,
      })),
      cursor,
    };
  }


  async getWithCache<T>(
    key: string,
    options?: { ttl?: number; binding?: string }
  ): Promise<T | null> {
    if (this.enableL1Cache) {
      const l1Value = this.l1Cache.get(key) as T | null;
      if (l1Value !== null) {
        return l1Value;
      }
    }

    const value = await this.get<T>(key, options?.binding);

    if (value !== null && this.enableL1Cache) {
      const ttl = options?.ttl ?? this.defaultTTL;
      this.l1Cache.set(key, value, ttl);
    }

    return value;
  }

  async putWithCache<T>(
    key: string,
    value: T,
    options?: { ttl?: number; binding?: string }
  ): Promise<void> {
    if (this.enableL1Cache) {
      const ttl = options?.ttl ?? this.defaultTTL;
      this.l1Cache.set(key, value, ttl);
    }

    await this.put(key, value, options);
  }


  async cacheAIResponse(
    key: string,
    response: AIResponse,
    options?: AIResponseCacheOptions
  ): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTTL;
    const tags = options?.tags || [];

    const cacheValue = {
      ...response,
      _tags: tags,
      _cachedAt: Date.now(),
    };

    await this.put(`ai:${key}`, cacheValue, { ttl, binding: options?.binding });

    for (const tag of tags) {
      const tagKey = `ai:tag:${tag}`;
      const taggedKeys = (await this.get<string[]>(tagKey, options?.binding)) || [];
      taggedKeys.push(key);
      await this.put(tagKey, taggedKeys, { ttl: ttl * 2, binding: options?.binding });
    }
  }

  async getCachedAIResponse(
    key: string,
    binding?: string
  ): Promise<AIResponse | null> {
    const cached = await this.get<AIResponse>(`ai:${key}`, binding);
    return cached;
  }

  async invalidateTagged(tag: string, binding?: string): Promise<void> {
    const tagKey = `ai:tag:${tag}`;
    const taggedKeys = await this.get<string[]>(tagKey, binding);

    if (!taggedKeys) return;

    for (const key of taggedKeys) {
      await this.delete(`ai:${key}`, binding);
    }

    await this.delete(tagKey, binding);
  }


  async warmCache(
    entries: Array<{
      key: string;
      value: unknown;
      ttl?: number;
    }>,
    binding?: string
  ): Promise<void> {
    if (this.enableL1Cache) {
      const defaultTtl = this.defaultTTL;
      for (const entry of entries) {
        this.l1Cache.set(entry.key, entry.value, entry.ttl ?? defaultTtl);
      }
    }

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

  async invalidatePattern(prefix: string, binding?: string): Promise<void> {
    if (this.enableL1Cache) {
      this.l1Cache.cleanup();
    }

    const BATCH_SIZE = 100;
    let cursor: string | undefined;

    do {
      const list = await this.list({ prefix, binding, limit: BATCH_SIZE, cursor });

      await Promise.all(
        list.keys.map((key) => {
          if (this.enableL1Cache) {
            this.l1Cache.delete(key.key);
          }
          return this.delete(key.key, binding);
        })
      );

      cursor = list.cursor;
    } while (cursor);
  }


  async getCacheStats(_binding?: string): Promise<{
    l1Size: number;
    l1Hits: number;
    l1HitRate: number;
  }> {
    if (this.enableL1Cache) {
      this.l1Cache.cleanup();
    }

    return {
      l1Size: this.l1Cache.size,
      l1Hits: 0,
      l1HitRate: 0,
    };
  }

  clearL1Cache(): void {
    this.l1Cache.clear();
  }

  cleanupL1Cache(): number {
    return this.l1Cache.cleanup();
  }
}

export const kvService = new KVService();
