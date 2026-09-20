/**
 * CORS Service
 * @description Cross-Origin Resource Sharing middleware for Cloudflare Workers
 */

import type { MiddlewareCORSConfig } from '../entities';

/**
 * Resolve the Access-Control-Allow-Origin value for a request.
 * - `*` config allows any origin.
 * - An explicit origin is echoed only when it is in the allowlist.
 * - Disallowed or missing origins get NO ACAO header (the browser blocks
 *   the response). Previously unknown origins fell back to
 *   `allowedOrigins[0]`, which granted CORS to everyone.
 */
function resolveAllowedOrigin(
  origin: string | null,
  config: MiddlewareCORSConfig
): string | null {
  if (config.allowedOrigins.includes('*')) {
    return '*';
  }
  if (origin && config.allowedOrigins.includes(origin)) {
    return origin;
  }
  return null;
}

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
  const allowedOrigin = resolveAllowedOrigin(origin, config);

  if (!allowedOrigin) {
    return response;
  }

  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  // Origin-specific allows must not be cached without revalidation per origin
  if (allowedOrigin !== '*') {
    headers.append('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
  headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

  if (config.exposedHeaders) {
    headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  }

  if (config.allowCredentials || config.credentials) {
    // `*` + credentials is always rejected by browsers — treat it as a
    // misconfiguration and refuse to send the wildcard instead.
    if (allowedOrigin === '*') {
      headers.delete('Access-Control-Allow-Origin');
    } else {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
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
    const allowedOrigin = resolveAllowedOrigin(origin, config);

    if (!allowedOrigin) {
      // Disallowed origin: no CORS headers — the browser reports a preflight
      // failure instead of granting access to the first configured origin.
      return new Response(null, { status: 403 });
    }

    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    if (allowedOrigin !== '*') {
      headers.append('Vary', 'Origin');
    }
    headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

    if (config.allowCredentials || config.credentials) {
      // `*` + credentials is always rejected by browsers — treat it as a
      // misconfiguration and refuse to send the wildcard (consistent with
      // addCorsHeaders).
      if (allowedOrigin === '*') {
        headers.delete('Access-Control-Allow-Origin');
      } else {
        headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }

    if (config.maxAge) {
      headers.set('Access-Control-Max-Age', config.maxAge.toString());
    }

    return new Response(null, { headers });
  }

  return null;
}
