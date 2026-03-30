/**
 * Auth Service
 * @description Authentication middleware for Cloudflare Workers with AI quota support and session management
 */

import type { MiddlewareAuthConfig } from '../entities';
import type { AIQuotaConfig } from '../../ai/entities';
import type { D1Service } from '../../d1/services/d1.service';
import type { KVService } from '../../kv/services/kv.service';

export type { MiddlewareAuthConfig };

// ============================================================
// Session Types
// ============================================================

export interface SessionData {
  sessionId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  data?: Record<string, unknown>;
}

export interface SessionOptions {
  ttl?: number;
  data?: Record<string, unknown>;
}

// ============================================================
// Session Manager
// ============================================================

export class SessionManager {
  private kv: KVService;
  private d1: D1Service;
  private tableName: string;

  constructor(kv: KVService, d1: D1Service, tableName: string = 'sessions') {
    this.kv = kv;
    this.d1 = d1;
    this.tableName = tableName;
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    options?: SessionOptions
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    const ttl = options?.ttl || 86400; // 24 hours default

    const sessionData: SessionData = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt: now + ttl * 1000,
      data: options?.data,
    };

    // Store in KV for fast access
    await this.kv.put(`session:${sessionId}`, sessionData, { ttl });

    // Store in D1 for persistence and querying
    await this.d1.insert(this.tableName, {
      session_id: sessionId,
      user_id: userId,
      created_at: now,
      expires_at: now + ttl * 1000,
      data: JSON.stringify(sessionData.data),
    });

    return sessionId;
  }

  /**
   * Validate session and return session data
   */
  async validateSession(token: string): Promise<SessionData | null> {
    // Check KV first (fast path)
    const session = await this.kv.get<SessionData>(`session:${token}`);

    if (!session) {
      // Check D1 if not in KV (might have been evicted)
      const result = await this.d1.findOne<SessionData>(
        `SELECT * FROM ${this.tableName} WHERE session_id = ? AND expires_at > ?`,
        [token, Date.now()]
      );

      if (result) {
        // Restore to KV
        const ttl = Math.floor((result.expiresAt - Date.now()) / 1000);
        if (ttl > 0) {
          await this.kv.put(`session:${token}`, result, { ttl });
        }
        return result;
      }

      return null;
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      await this.destroySession(token);
      return null;
    }

    return session;
  }

  /**
   * Refresh session (extend expiration)
   */
  async refreshSession(token: string, ttl?: number): Promise<string> {
    const session = await this.validateSession(token);

    if (!session) {
      throw new Error('Invalid or expired session');
    }

    const newTTL = ttl || 86400;
    const now = Date.now();

    session.expiresAt = now + newTTL * 1000;

    // Update KV
    await this.kv.put(`session:${token}`, session, { ttl: newTTL });

    // Update D1
    await this.d1.query(
      `UPDATE ${this.tableName} SET expires_at = ? WHERE session_id = ?`,
      [session.expiresAt, token]
    );

    return token;
  }

  /**
   * Destroy a specific session
   */
  async destroySession(token: string): Promise<void> {
    await this.kv.delete(`session:${token}`);
    await this.d1.query(
      `DELETE FROM ${this.tableName} WHERE session_id = ?`,
      [token]
    );
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string): Promise<void> {
    // Get all sessions for user from D1
    const result = await this.d1.query<{ session_id: string }>(
      `SELECT session_id FROM ${this.tableName} WHERE user_id = ?`,
      [userId]
    );

    // Delete each session
    for (const row of result.rows) {
      await this.destroySession(row.session_id);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.d1.query<{ session_id: string }>(
      `SELECT session_id FROM ${this.tableName} WHERE expires_at < ?`,
      [Date.now()]
    );

    for (const row of result.rows) {
      await this.kv.delete(`session:${row.session_id}`);
    }

    // Delete from D1
    await this.d1.query(
      `DELETE FROM ${this.tableName} WHERE expires_at < ?`,
      [Date.now()]
    );

    return result.rows.length || 0;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// ============================================================
// Enhanced Auth Middleware
// ============================================================

/**
 * Enhanced require authentication with user validation and logging
 */
export async function requireAuth(
  request: Request,
  config: MiddlewareAuthConfig & {
    validateUser?: (userId: string) => Promise<boolean>;
    logAccess?: (userId: string, success: boolean, resource: string) => void | Promise<void>;
  }
): Promise<Response | null> {
  if (!config.enabled) {
    return null;
  }

  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let userId: string | null = null;
  let authenticated = false;

  switch (config.type) {
    case 'bearer':
      if (!authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Invalid authorization type' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      const token = authHeader.substring(7);

      // Custom token validation
      if (config.validateToken) {
        const isValid = await config.validateToken(token);
        if (!isValid) {
          if (config.logAccess) {
            await config.logAccess(token, false, request.url);
          }
          return new Response(
            JSON.stringify({ error: 'Invalid token' }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        // Extract user ID from token validation
        userId = token; // In production, decode JWT or lookup user
        authenticated = true;
      } else if (token === config.token) {
        userId = token;
        authenticated = true;
      }
      break;

    case 'apikey':
      const apiKey = request.headers.get(config.apiKeyHeader || 'X-API-Key');
      if (apiKey !== config.apiKeyValue) {
        if (config.logAccess) {
          await config.logAccess(apiKey || 'unknown', false, request.url);
        }
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      userId = apiKey;
      authenticated = true;
      break;

    case 'basic':
      if (!authHeader.startsWith('Basic ')) {
        return new Response(
          JSON.stringify({ error: 'Invalid authorization type' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      const credentials = atob(authHeader.substring(6));
      const [username, password] = credentials.split(':');
      if (username !== config.username || password !== config.password) {
        if (config.logAccess) {
          await config.logAccess(username, false, request.url);
        }
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      userId = username;
      authenticated = true;
      break;
  }

  // Additional user validation if provided
  if (authenticated && userId && config.validateUser) {
    const isValid = await config.validateUser(userId);
    if (!isValid) {
      if (config.logAccess) {
        await config.logAccess(userId, false, request.url);
      }
      return new Response(
        JSON.stringify({ error: 'User not authorized' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Log successful access
  if (authenticated && userId && config.logAccess) {
    await config.logAccess(userId, true, request.url);
  }

  return null;
}

/**
 * Require AI quota (AI-specific rate limiting based on neuron usage)
 */
export async function requireAIQuota(
  request: Request,
  config: AIQuotaConfig & {
    kv?: KVNamespace;
    logExceeded?: (userId: string, quota: number, usage: number) => void | Promise<void>;
  }
): Promise<Response | null> {
  if (!config.enabled) {
    return null;
  }

  const userId = config.userId || request.headers.get('X-User-ID') || 'anonymous';

  // Check quota from KV
  if (config.kv) {
    const periodKey = `ai_quota:${userId}:${Math.floor(Date.now() / (config.period * 1000))}`;
    const currentUsage = await config.kv.get(periodKey, 'json');

    const usage = (currentUsage as { neurons: number })?.neurons || 0;

    if (usage >= config.quota) {
      // Log quota exceeded
      if (config.logExceeded) {
        await config.logExceeded(userId, config.quota, usage);
      }

      return new Response(
        JSON.stringify({
          error: 'AI quota exceeded',
          quota: config.quota,
          usage,
          resetAt: Math.floor((Date.now() / (config.period * 1000)) + 1) * config.period * 1000,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(config.period),
          },
        }
      );
    }

    return null;
  }

  // No KV configured, allow request
  return null;
}

/**
 * Add user context to request (enhanced)
 */
export function addUserContext(request: Request, user: {
  id: string;
  [key: string]: unknown;
}): Request {
  const headers = new Headers(request.headers);
  headers.set('X-User-ID', user.id);
  headers.set('X-User-Context', JSON.stringify(user));

  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
  });
}

