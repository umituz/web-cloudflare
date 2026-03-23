/**
 * Cache Service
 * @description Caching middleware for Cloudflare Workers
 */

import type { MiddlewareCacheConfig } from '../entities';

export type { MiddlewareCacheConfig };

interface CacheEntry {
  response: Response;
  expires: number;
}

const cacheStore = new Map<string, CacheEntry>();

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

  const url = new URL(request.url);
  const cacheKey = `${config.prefix || 'cache'}:${url.pathname}${url.search}`;

  // Check if path should bypass cache
  if (config.bypassPaths?.some((path) => url.pathname.startsWith(path))) {
    return null;
  }

  // Check cache
  const cached = cacheStore.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.response;
  }

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

  // Cache the response
  cacheStore.set(cacheKey, {
    response: response.clone(),
    expires: Date.now() + ttl * 1000,
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
