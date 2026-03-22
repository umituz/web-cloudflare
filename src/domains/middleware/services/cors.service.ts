/**
 * CORS Service
 * @description Cross-Origin Resource Sharing middleware for Cloudflare Workers
 */

import type { MiddlewareCORSConfig } from '../entities';

// Type alias for backwards compatibility
export type CORSConfig = MiddlewareCORSConfig;

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(
  request: Request,
  response: Response,
  config: MiddlewareCORSConfig
): Response {
  if (!config.enabled) {
    return response;
  }

  const headers = new Headers(response.headers);
  const origin = request.headers.get('Origin');

  // Check if origin is allowed
  const allowedOrigin = config.allowedOrigins.includes('*')
    ? '*'
    : origin && config.allowedOrigins.includes(origin)
    ? origin
    : config.allowedOrigins[0];

  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
  headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

  if (config.exposedHeaders) {
    headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  }

  if (config.allowCredentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  if (config.maxAge) {
    headers.set('Access-Control-Max-Age', config.maxAge.toString());
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * CORS middleware
 */
export async function cors(
  request: Request,
  config: MiddlewareCORSConfig
): Promise<Response | null> {
  if (!config.enabled) {
    return null;
  }

  // Handle preflight request
  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    const origin = request.headers.get('Origin');

    const allowedOrigin = config.allowedOrigins.includes('*')
      ? '*'
      : origin && config.allowedOrigins.includes(origin)
      ? origin
      : config.allowedOrigins[0];

    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

    if (config.maxAge) {
      headers.set('Access-Control-Max-Age', config.maxAge.toString());
    }

    return new Response(null, { headers });
  }

  return null;
}
