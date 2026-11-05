
import type { MiddlewareAuthConfig } from '../entities';
import type { AIQuotaConfig } from '../../ai/entities';
import type { D1Service } from '../../d1/services/d1.service';
import type { KVService } from '../../kv/services/kv.service';
import { secureCompare, randomString } from '../../../infrastructure/utils/helpers';

export type { MiddlewareAuthConfig };


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


export class SessionManager {
  private kv: KVService;
  private d1: D1Service;
  private tableName: string;

  constructor(kv: KVService, d1: D1Service, tableName: string = 'sessions') {
    this.kv = kv;
    this.d1 = d1;
    this.tableName = tableName;
  }

  async createSession(
    userId: string,
    options?: SessionOptions
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    const ttl = options?.ttl || 86400;

    const sessionData: SessionData = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt: now + ttl * 1000,
      data: options?.data,
    };

    await this.kv.put(`session:${sessionId}`, sessionData, { ttl });

    await this.d1.insert(this.tableName, {
      session_id: sessionId,
      user_id: userId,
      created_at: now,
      expires_at: now + ttl * 1000,
      data: JSON.stringify(sessionData.data),
    });

    return sessionId;
  }

  async validateSession(token: string): Promise<SessionData | null> {
    const session = await this.kv.get<SessionData>(`session:${token}`);

    if (!session) {
      const result = await this.d1.findOne<SessionData>(
        `SELECT * FROM ${this.tableName} WHERE session_id = ? AND expires_at > ?`,
        [token, Date.now()]
      );

      if (result) {
        const ttl = Math.floor((result.expiresAt - Date.now()) / 1000);
        if (ttl > 0) {
          await this.kv.put(`session:${token}`, result, { ttl });
        }
        return result;
      }

      return null;
    }

    if (Date.now() > session.expiresAt) {
      await this.destroySession(token);
      return null;
    }

    return session;
  }

  async refreshSession(token: string, ttl?: number): Promise<string> {
    const session = await this.validateSession(token);

    if (!session) {
      throw new Error('Invalid or expired session');
    }

    const newTTL = ttl || 86400;
    const now = Date.now();

    session.expiresAt = now + newTTL * 1000;

    await this.kv.put(`session:${token}`, session, { ttl: newTTL });

    await this.d1.query(
      `UPDATE ${this.tableName} SET expires_at = ? WHERE session_id = ?`,
      [session.expiresAt, token]
    );

    return token;
  }

  async destroySession(token: string): Promise<void> {
    await this.kv.delete(`session:${token}`);
    await this.d1.query(
      `DELETE FROM ${this.tableName} WHERE session_id = ?`,
      [token]
    );
  }

  async destroyUserSessions(userId: string): Promise<void> {
    const result = await this.d1.query<{ session_id: string }>(
      `SELECT session_id FROM ${this.tableName} WHERE user_id = ?`,
      [userId]
    );

    for (const row of result.rows) {
      await this.destroySession(row.session_id);
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.d1.query<{ session_id: string }>(
      `SELECT session_id FROM ${this.tableName} WHERE expires_at < ?`,
      [Date.now()]
    );

    for (const row of result.rows) {
      await this.kv.delete(`session:${row.session_id}`);
    }

    await this.d1.query(
      `DELETE FROM ${this.tableName} WHERE expires_at < ?`,
      [Date.now()]
    );

    return result.rows.length || 0;
  }

  private generateSessionId(): string {
    return `${Date.now().toString(36)}-${randomString(24).toLowerCase()}`;
  }
}


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

  const unauthorized = (error: string): Response =>
    new Response(JSON.stringify({ error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return unauthorized('Missing authorization header');
  }

  let userId: string | null = null;
  let authenticated = false;

  switch (config.type) {
    case 'bearer': {
      if (!authHeader.startsWith('Bearer ')) {
        return unauthorized('Invalid authorization type');
      }
      const token = authHeader.substring(7);

      if (config.validateToken) {
        const isValid = await config.validateToken(token);
        if (!isValid) {
          if (config.logAccess) {
            await config.logAccess(token, false, request.url);
          }
          return unauthorized('Invalid token');
        }
        userId = token;
        authenticated = true;
      } else if (config.token && secureCompare(token, config.token)) {
        userId = 'token-user';
        authenticated = true;
      } else {
        return unauthorized('Invalid token');
      }
      break;
    }

    case 'apikey': {
      const apiKey = request.headers.get(config.apiKeyHeader || 'X-API-Key');
      if (!config.apiKeyValue || !apiKey || !secureCompare(apiKey, config.apiKeyValue)) {
        if (config.logAccess) {
          await config.logAccess(apiKey || 'unknown', false, request.url);
        }
        return unauthorized('Invalid API key');
      }
      userId = 'api-key-user';
      authenticated = true;
      break;
    }

    case 'basic': {
      if (!authHeader.startsWith('Basic ')) {
        return unauthorized('Invalid authorization type');
      }
      let credentials: string;
      try {
        credentials = atob(authHeader.substring(6));
      } catch {
        return unauthorized('Invalid credentials');
      }
      const separatorIndex = credentials.indexOf(':');
      const username = separatorIndex === -1 ? credentials : credentials.substring(0, separatorIndex);
      const password = separatorIndex === -1 ? '' : credentials.substring(separatorIndex + 1);
      if (
        !config.username || !config.password ||
        !secureCompare(username, config.username) || !secureCompare(password, config.password)
      ) {
        if (config.logAccess) {
          await config.logAccess(username, false, request.url);
        }
        return unauthorized('Invalid credentials');
      }
      userId = username;
      authenticated = true;
      break;
    }

    case 'custom': {
      if (!config.validate) {
        return unauthorized('Auth type "custom" requires a validate function');
      }
      const isValid = await config.validate(request);
      if (!isValid) {
        if (config.logAccess) {
          await config.logAccess('unknown', false, request.url);
        }
        return unauthorized('Invalid credentials');
      }
      userId = request.headers.get('X-User-ID') || 'custom-auth-user';
      authenticated = true;
      break;
    }
  }

  if (!authenticated || !userId) {
    return unauthorized('Unauthorized');
  }

  if (config.validateUser) {
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

  if (config.logAccess) {
    await config.logAccess(userId, true, request.url);
  }

  return null;
}

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

  if (config.kv) {
    const periodKey = `ai_quota:${userId}:${Math.floor(Date.now() / (config.period * 1000))}`;
    const currentUsage = await config.kv.get(periodKey, 'json');

    const usage = (currentUsage as { neurons: number })?.neurons || 0;

    if (usage >= config.quota) {
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

  return null;
}

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

