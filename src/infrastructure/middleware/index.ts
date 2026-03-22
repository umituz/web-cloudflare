/**
 * Cloudflare Middleware Collection
 * @description Comprehensive middleware for Cloudflare Workers
 * @deprecated Import from '@umituz/web-cloudflare/middleware' instead
 */

// Re-export from middleware domain
export * from '../../domains/middleware';

// ============================================================
// Environment Types (kept for backwards compatibility)
// ============================================================

export interface CloudflareMiddlewareEnv {
  KV?: KVNamespace;
  R2?: R2Bucket;
  D1?: D1Database;
  DO?: Record<string, DurableObjectNamespace>;
  QUEUE?: Record<string, Queue>;
  AI?: any;
  vars?: Record<string, string>;
}

// Type alias for backwards compatibility
export type Env = CloudflareMiddlewareEnv;

// ============================================================
// New Middleware
// ============================================================

/**
 * Compression Middleware
 */
export async function compression(
  request: Request,
  response: Response
): Promise<Response> {
  const acceptEncoding = request.headers.get('Accept-Encoding') || '';
  const contentType = response.headers.get('Content-Type') || '';

  // Check if client accepts compression
  if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('br')) {
    return response;
  }

  // Check if content type is compressible
  const compressibleTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/xhtml+xml',
  ];

  const isCompressible = compressibleTypes.some((type) =>
    contentType.includes(type)
  );

  if (!isCompressible) {
    return response;
  }

  // Return original response (Cloudflare handles compression automatically)
  return response;
}

/**
 * Security Headers Middleware
 */
export interface SecurityHeadersConfig {
  frameGuard?: boolean;
  contentTypeNosniff?: boolean;
  xssProtection?: boolean;
  strictTransportSecurity?: boolean;
  referrerPolicy?: string;
  contentSecurityPolicy?: string;
}

export function addSecurityHeaders(
  response: Response,
  config: SecurityHeadersConfig = {}
): Response {
  const headers = new Headers(response.headers);

  if (config.frameGuard !== false) {
    headers.set('X-Frame-Options', 'DENY');
  }

  if (config.contentTypeNosniff !== false) {
    headers.set('X-Content-Type-Options', 'nosniff');
  }

  if (config.xssProtection !== false) {
    headers.set('X-XSS-Protection', '1; mode=block');
  }

  if (config.strictTransportSecurity) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (config.referrerPolicy) {
    headers.set('Referrer-Policy', config.referrerPolicy);
  }

  if (config.contentSecurityPolicy) {
    headers.set('Content-Security-Policy', config.contentSecurityPolicy);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Bot Detection Middleware
 */
export async function detectBot(request: Request): Promise<{
  isBot: boolean;
  botType?: string;
}> {
  const userAgent = request.headers.get('User-Agent') || '';
  const botPatterns = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegrambot/i,
    /applebot/i,
    /semrushbot/i,
    /ahrefsbot/i,
    /mj12bot/i,
  ];

  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      return {
        isBot: true,
        botType: pattern.source.replace('/i', '').replace('/', ''),
      };
    }
  }

  return { isBot: false };
}

/**
 * Request Logging Middleware
 */
export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  includeHeaders?: boolean;
  includeBody?: boolean;
  sampleRate?: number;
}

export async function logRequest(
  request: Request,
  config: LogConfig = { level: 'info' }
): Promise<void> {
  // Sample rate check
  if (config.sampleRate && Math.random() > config.sampleRate) {
    return;
  }

  const url = new URL(request.url);
  const logData: Record<string, unknown> = {
    method: request.method,
    url: url.pathname,
    timestamp: Date.now(),
    userAgent: request.headers.get('User-Agent'),
    ip: request.headers.get('CF-Connecting-IP'),
  };

  if (config.includeHeaders) {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    logData.headers = headers;
  }

  if (config.includeBody && request.method !== 'GET') {
    try {
      const clone = request.clone();
      logData.body = await clone.json();
    } catch {
      // Body not JSON or already consumed
    }
  }

  switch (config.level) {
    case 'debug':
      console.debug('[Request]', JSON.stringify(logData));
      break;
    case 'info':
      console.info('[Request]', JSON.stringify(logData));
      break;
    case 'warn':
      console.warn('[Request]', JSON.stringify(logData));
      break;
    case 'error':
      console.error('[Request]', JSON.stringify(logData));
      break;
  }
}

/**
 * Response Time Tracking Middleware
 */
export async function trackResponseTime(
  handler: () => Promise<Response>
): Promise<{ response: Response; duration: number }> {
  const start = Date.now();
  const response = await handler();
  const duration = Date.now() - start;

  // Add timing header
  response.headers.set('X-Response-Time', `${duration}ms`);

  return { response, duration };
}

/**
 * IP Filter Middleware
 */
export interface IPFilterConfig {
  mode: 'whitelist' | 'blacklist';
  ips: string[];
  cidrs?: string[];
}

export function checkIPFilter(
  request: Request,
  config: IPFilterConfig
): Response | null {
  const ip = request.headers.get('CF-Connecting-IP');

  if (!ip) {
    return new Response('IP not found', { status: 400 });
  }

  const isAllowed = config.ips.includes(ip);

  if (config.mode === 'whitelist' && !isAllowed) {
    return new Response('IP not allowed', { status: 403 });
  }

  if (config.mode === 'blacklist' && isAllowed) {
    return new Response('IP blocked', { status: 403 });
  }

  return null;
}

/**
 * Method Override Middleware
 */
export function methodOverride(request: Request): Request {
  const method = request.headers.get('X-HTTP-Method-Override');
  const url = new URL(request.url);
  const bodyMethod = url.searchParams.get('_method');

  const overrideMethod = method || bodyMethod;

  if (overrideMethod && ['PUT', 'PATCH', 'DELETE'].includes(overrideMethod.toUpperCase())) {
    // Return modified request
    return new Request(request.url, {
      method: overrideMethod.toUpperCase(),
      headers: request.headers,
      body: request.body,
    });
  }

  return request;
}

/**
 * Request ID Middleware
 */
export function addRequestID(request: Request): string {
  const existingID = request.headers.get('X-Request-ID');

  if (existingID) {
    return existingID;
  }

  const requestID = crypto.randomUUID();
  return requestID;
}

/**
 * Response Time Middleware
 */
export function responseTime(): Response {
  const response = new Response(JSON.stringify({ time: Date.now() }), {
    headers: { 'Content-Type': 'application/json' },
  });
  return response;
}

/**
 * Health Check Middleware
 */
export interface HealthCheckConfig {
  uptime: number;
  checks: Record<string, () => Promise<boolean>>;
}

export async function healthCheck(
  env: CloudflareMiddlewareEnv,
  config?: HealthCheckConfig
): Promise<Response> {
  const checks: Record<string, boolean | string> = {
    healthy: true,
    timestamp: new Date().toISOString(),
    uptime: config?.uptime || process.uptime?.() || 0,
  };

  if (config?.checks) {
    for (const [name, check] of Object.entries(config.checks)) {
      try {
        checks[name] = await check();
      } catch (error) {
        checks[name] = error instanceof Error ? error.message : String(error);
        checks.healthy = false;
      }
    }
  }

  const status = checks.healthy ? 200 : 503;
  return Response.json(checks, { status });
}

/**
 * Error Handling Middleware
 */
export interface ErrorHandlerConfig {
  debug: boolean;
  logger?: (error: Error) => void;
}

export function handleMiddlewareError(
  error: Error,
  config: ErrorHandlerConfig = { debug: false }
): Response {
  if (config.logger) {
    config.logger(error);
  } else {
    console.error('[Middleware Error]', error);
  }

  const status = 500;
  const body: Record<string, unknown> = {
    error: 'Internal Server Error',
    status,
  };

  if (config.debug) {
    body.message = error.message;
    body.stack = error.stack;
  }

  return Response.json(body, { status });
}

/**
 * Conditional Middleware (Chain)
 */
export function conditionalChainMiddleware(
  condition: (request: Request) => boolean,
  middleware: (request: Request) => Response | null
): (request: Request) => Response | null {
  return (request: Request) => {
    if (condition(request)) {
      return middleware(request);
    }
    return null;
  };
}

/**
 * Chain Middleware
 */
export function chainMiddleware(
  ...middlewares: Array<(request: Request) => Response | null>
): (request: Request) => Response | null {
  return (request: Request) => {
    for (const middleware of middlewares) {
      const response = middleware(request);
      if (response) {
        return response;
      }
    }
    return null;
  };
}

/**
 * Async Middleware Chain
 */
export async function chainAsyncMiddleware(
  request: Request,
  ...middlewares: Array<(request: Request) => Promise<Response | null>>
): Promise<Response | null> {
  for (const middleware of middlewares) {
    const response = await middleware(request);
    if (response) {
      return response;
    }
  }
  return null;
}
