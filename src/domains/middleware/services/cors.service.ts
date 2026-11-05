
import type { MiddlewareCORSConfig } from '../entities';

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
  if (allowedOrigin !== '*') {
    headers.append('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
  headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

  if (config.exposedHeaders) {
    headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  }

  if (config.allowCredentials || config.credentials) {
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

export async function cors(
  request: Request,
  config: MiddlewareCORSConfig
): Promise<Response | null> {
  if (!config.enabled) {
    return null;
  }

  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    const origin = request.headers.get('Origin');
    const allowedOrigin = resolveAllowedOrigin(origin, config);

    if (!allowedOrigin) {
      return new Response(null, { status: 403 });
    }

    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    if (allowedOrigin !== '*') {
      headers.append('Vary', 'Origin');
    }
    headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

    if (config.allowCredentials || config.credentials) {
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
