
import type { MiddlewareCacheConfig } from '../entities';

export type { MiddlewareCacheConfig };

interface CacheEntry {
  response: Response;
  expires: number;
  lastAccess: number;
  hits: number;
}

const cacheStore = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 5000;
const CLEANUP_INTERVAL = 30000;

let cacheHits = 0;
let cacheMisses = 0;
let lastCleanup = Date.now();

function cleanupCache(): void {
  const now = Date.now();

  if (now - lastCleanup < CLEANUP_INTERVAL && cacheStore.size < MAX_CACHE_ENTRIES) {
    return;
  }

  lastCleanup = now;

  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expires < now) {
      cacheStore.delete(key);
    }
  }

  if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    const entries = Array.from(cacheStore.entries())
      .sort((a, b) => {
        if (a[1].expires < now && b[1].expires >= now) return -1;
        if (b[1].expires < now && a[1].expires >= now) return 1;
        return a[1].lastAccess - b[1].lastAccess;
      });

    const toRemove = Math.floor(MAX_CACHE_ENTRIES * 0.15);
    for (let i = 0; i < toRemove; i++) {
      const entry = entries[i];
      if (entry) {
        cacheStore.delete(entry[0]);
      }
    }
  }
}

export function getCacheStats(): { hits: number; misses: number; size: number; hitRate: number } {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    size: cacheStore.size,
    hitRate: total > 0 ? cacheHits / total : 0,
  };
}

export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

export async function cache(
  request: Request,
  config: MiddlewareCacheConfig
): Promise<Response | null> {
  if (!config.enabled) {
    return null;
  }

  cleanupCache();

  const url = new URL(request.url);
  const cacheKey = `${config.prefix || 'cache'}:${url.pathname}${url.search}`;

  if (config.bypassPaths?.some((path) => url.pathname.startsWith(path))) {
    return null;
  }

  const cached = cacheStore.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expires > now) {
    cached.lastAccess = now;
    cached.hits++;
    cacheHits++;

    return cached.response.clone();
  }

  if (cached && cached.expires <= now) {
    cacheStore.delete(cacheKey);
  }

  cacheMisses++;
  return null;
}

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

  let ttl = config.defaultTTL;
  for (const [path, pathTTL] of Object.entries(config.paths || {})) {
    if (url.pathname.startsWith(path)) {
      ttl = pathTTL;
      break;
    }
  }

  if (ttl === 0) {
    return;
  }

  if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    cleanupCache();
  }

  cacheStore.set(cacheKey, {
    response: response.clone(),
    expires: Date.now() + ttl * 1000,
    lastAccess: Date.now(),
    hits: 0,
  });
}

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

export function getCacheSize(): number {
  return cacheStore.size;
}
