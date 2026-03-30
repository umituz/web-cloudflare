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

// ============================================================
// User-Based Quota Tracking
// ============================================================

interface UserQuotaEntry {
  quota: number;
  usage: number;
  resetTime: number;
}

const userQuotaStore = new Map<string, UserQuotaEntry>();

/**
 * Check user quota (general purpose quota tracking)
 */
export async function checkUserQuota(
  userId: string,
  quota: number,
  window: number,
  kv?: KVNamespace
): Promise<boolean> {
  // Check KV first if available
  if (kv) {
    const periodKey = `user_quota:${userId}:${Math.floor(Date.now() / (window * 1000))}`;
    const currentUsage = await kv.get(periodKey, 'json');

    const usage = (currentUsage as { count: number })?.count || 0;

    if (usage >= quota) {
      return false;
    }

    // Increment usage
    await kv.put(periodKey, JSON.stringify({ count: usage + 1 }), {
      expirationTtl: window,
    });

    return true;
  }

  // Fallback to in-memory store
  const now = Date.now();
  const entry = userQuotaStore.get(userId);

  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    userQuotaStore.set(userId, {
      quota,
      usage: 1,
      resetTime: now + window * 1000,
    });
    return true;
  }

  // Check if exceeded
  if (entry.usage >= quota) {
    return false;
  }

  // Increment usage
  entry.usage++;
  return true;
}

// ============================================================
// AI-Specific Quota Tracking (Neuron-based)
// ============================================================

interface AIQuotaEntry {
  quota: number; // Neurons per period
  usage: number; // Neurons used
  resetTime: number;
  period: number; // Period in seconds
}

const aiQuotaStore = new Map<string, AIQuotaEntry>();

/**
 * Check AI quota (based on neuron usage)
 */
export async function checkAIQuota(
  userId: string,
  neurons: number,
  config: {
    quota: number;
    period: number;
    kv?: KVNamespace;
  }
): Promise<{ allowed: boolean; remaining: number; resetAt: number; currentUsage: number }> {
  const periodKey = `ai_quota:${userId}:${Math.floor(Date.now() / (config.period * 1000))}`;

  // Check KV first if available
  if (config.kv) {
    const currentUsage = await config.kv.get(periodKey, 'json');
    const usage = (currentUsage as { neurons: number })?.neurons || 0;

    const newUsage = usage + neurons;

    if (newUsage > config.quota) {
      return {
        allowed: false,
        remaining: Math.max(0, config.quota - usage),
        resetAt: (Math.floor(Date.now() / (config.period * 1000)) + 1) * config.period * 1000,
        currentUsage: usage,
      };
    }

    // Update usage
    await config.kv.put(periodKey, JSON.stringify({ neurons: newUsage }), {
      expirationTtl: config.period,
    });

    return {
      allowed: true,
      remaining: config.quota - newUsage,
      resetAt: (Math.floor(Date.now() / (config.period * 1000)) + 1) * config.period * 1000,
      currentUsage: newUsage,
    };
  }

  // Fallback to in-memory store
  const now = Date.now();
  const entry = aiQuotaStore.get(userId);

  // Reset if window expired or doesn't exist
  if (!entry || now > entry.resetTime || entry.period !== config.period) {
    if (neurons > config.quota) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + config.period * 1000,
        currentUsage: 0,
      };
    }

    aiQuotaStore.set(userId, {
      quota: config.quota,
      usage: neurons,
      resetTime: now + config.period * 1000,
      period: config.period,
    });

    return {
      allowed: true,
      remaining: config.quota - neurons,
      resetAt: now + config.period * 1000,
      currentUsage: neurons,
    };
  }

  // Check if would exceed quota
  const newUsage = entry.usage + neurons;

  if (newUsage > entry.quota) {
    return {
      allowed: false,
      remaining: Math.max(0, entry.quota - entry.usage),
      resetAt: entry.resetTime,
      currentUsage: entry.usage,
    };
  }

  // Update usage
  entry.usage = newUsage;

  return {
    allowed: true,
    remaining: entry.quota - newUsage,
    resetAt: entry.resetTime,
    currentUsage: newUsage,
  };
}
