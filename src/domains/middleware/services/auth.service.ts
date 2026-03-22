/**
 * Auth Service
 * @description Authentication middleware for Cloudflare Workers
 */

import type { AuthConfig } from '../entities';

/**
 * Require authentication
 */
export async function requireAuth(
  request: Request,
  config: AuthConfig
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
      if (token !== config.token) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      break;

    case 'apikey':
      const apiKey = request.headers.get(config.apiKeyHeader || 'X-API-Key');
      if (apiKey !== config.apiKeyValue) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
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
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      break;
  }

  return null;
}

/**
 * Add user context to request
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
