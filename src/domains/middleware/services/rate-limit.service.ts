/**
 * Rate Limit Service
 * @description Rate limiting middleware for Cloudflare Workers
 */

import type { MiddlewareRateLimitConfig } from '../entities';

export type { MiddlewareRateLimitConfig };

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 10000; // Prevent memory leak
const CLEANUP_INTERVAL = 60000; // 1 minute

// Periodic cleanup to prevent memory leak
let lastCleanup = Date.now();

/**
 * Cleanup expired entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();

  // Run cleanup periodically
  if (now - lastCleanup < CLEANUP_INTERVAL && rateLimitStore.size < MAX_ENTRIES) {
    return;
  }

  lastCleanup = now;
  const cutoffTime = now - 3600000; // 1 hour ago

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < cutoffTime) {
      rateLimitStore.delete(key);
    }
  }

  // If still too many entries, remove oldest accessed
  if (rateLimitStore.size >= MAX_ENTRIES) {
    const entries = Array.from(rateLimitStore.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toRemove = Math.floor(MAX_ENTRIES * 0.1); // Remove 10%
    for (let i = 0; i < toRemove; i++) {
      rateLimitStore.delete(entries[i][0]);
    }
  }
}

/**
 * Get rate limit key
 */
function getRateLimitKey(request: Request, config: MiddlewareRateLimitConfig): string {
  const parts: string[] = [];

  if (config.by === 'ip' || config.by === 'both') {
    parts.push(request.headers.get('CF-Connecting-IP') || 'unknown');
  }

  if (config.by === 'user' || config.by === 'both') {
    const auth = request.headers.get('Authorization');
    if (auth) {
      parts.push(auth.substring(0, 20));
    }
  }

  if (config.customKeys) {
    for (const key of config.customKeys) {
      parts.push(request.headers.get(key) || '');
    }
  }

  return parts.join(':') || 'default';
}

/**
 * Check rate limit
 */
export async function checkRateLimit(
  request: Request,
  config: MiddlewareRateLimitConfig
): Promise<Response | null> {
  if (!config.enabled) {
    return null;
  }

  // Run cleanup before checking
  cleanupExpiredEntries();

  const key = getRateLimitKey(request, config);

  // Check whitelist
  if (config.whitelist?.includes(key)) {
    return null;
  }

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.window * 1000,
      lastAccess: now,
    });
    return null;
  }

  // Update last access
  entry.lastAccess = now;

  // Increment count
  entry.count++;

  // Check if exceeded
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return new Response(
      JSON.stringify({
        error: config.response?.message || 'Rate limit exceeded',
        retryAfter,
      }),
      {
        status: config.response?.status || 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }

  return null;
}
