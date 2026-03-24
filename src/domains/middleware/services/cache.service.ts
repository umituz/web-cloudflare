/**
 * Cache Service
 * @description Caching middleware for Cloudflare Workers
 */

import type { MiddlewareCacheConfig } from '../entities';

export type { MiddlewareCacheConfig };

interface CacheEntry {
  response: Response;
  expires: number;
  lastAccess: number;
  hits: number;
}

const cacheStore = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 5000; // Prevent memory leak
const CLEANUP_INTERVAL = 30000; // 30 seconds

// Track cache statistics
let cacheHits = 0;
let cacheMisses = 0;
let lastCleanup = Date.now();

/**
 * Cleanup expired and least recently used entries
 */
function cleanupCache(): void {
  const now = Date.now();

  // Run cleanup periodically
  if (now - lastCleanup < CLEANUP_INTERVAL && cacheStore.size < MAX_CACHE_ENTRIES) {
    return;
  }

  lastCleanup = now;

  // Remove expired entries
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expires < now) {
      cacheStore.delete(key);
    }
  }

  // If still too many entries, remove least recently used (LRU)
  if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    const entries = Array.from(cacheStore.entries())
      .sort((a, b) => {
        // First, prioritize removing expired
        if (a[1].expires < now && b[1].expires >= now) return -1;
        if (b[1].expires < now && a[1].expires >= now) return 1;
        // Then, sort by last access (oldest first)
        return a[1].lastAccess - b[1].lastAccess;
      });

    const toRemove = Math.floor(MAX_CACHE_ENTRIES * 0.15); // Remove 15%
    for (let i = 0; i < toRemove; i++) {
      cacheStore.delete(entries[i][0]);
    }
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { hits: number; misses: number; size: number; hitRate: number } {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    size: cacheStore.size,
    hitRate: total > 0 ? cacheHits / total : 0,
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Cache middleware
 */
export async function cache(
  request: Request,
  config: MiddlewareCacheConfig
): Promise<Response | null> {
  if (!config.enabled) {
    return null;
  }

  // Run cleanup before checking
  cleanupCache();

  const url = new URL(request.url);
  const cacheKey = `${config.prefix || 'cache'}:${url.pathname}${url.search}`;

  // Check if path should bypass cache
  if (config.bypassPaths?.some((path) => url.pathname.startsWith(path))) {
    return null;
  }

  // Check cache
  const cached = cacheStore.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expires > now) {
    // Update access tracking
    cached.lastAccess = now;
    cached.hits++;
    cacheHits++;

    // Return cloned response to avoid consuming the original
    return cached.response.clone();
  }

  // Remove expired entry
  if (cached && cached.expires <= now) {
    cacheStore.delete(cacheKey);
  }

  cacheMisses++;
  return null;
}

/**
 * Set cache
 */
export function setCache(
  request: Request,
  response: Response,
  config: MiddlewareCacheConfig
): void {
  if (!config.enabled) {
    return;
  }

  const url = new URL(request.url);
  const cacheKey = `${config.prefix || 'cache'}:${url.pathname}${url.search}`;

  // Determine TTL
  let ttl = config.defaultTTL;
  for (const [path, pathTTL] of Object.entries(config.paths || {})) {
    if (url.pathname.startsWith(path)) {
      ttl = pathTTL;
      break;
    }
  }

  // Don't cache if TTL is 0
  if (ttl === 0) {
    return;
  }

  // Check cache size limit
  if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    cleanupCache();
  }

  // Cache the response
  cacheStore.set(cacheKey, {
    response: response.clone(),
    expires: Date.now() + ttl * 1000,
    lastAccess: Date.now(),
    hits: 0,
  });
}

/**
 * Invalidate cache
 */
export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cacheStore.clear();
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key.includes(pattern)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Get cache size
 */
export function getCacheSize(): number {
  return cacheStore.size;
}
