/**
 * Rate Limit Service
 * @description Rate limiting middleware for Cloudflare Workers
 */

import type { MiddlewareRateLimitConfig } from '../entities';

// Type aliases for backwards compatibility
export type { MiddlewareRateLimitConfig };
export type RateLimitConfig = MiddlewareRateLimitConfig;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

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
    });
    return null;
  }

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
