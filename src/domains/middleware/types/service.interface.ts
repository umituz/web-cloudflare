/**
 * Middleware Service Interface
 * @description Defines the contract for middleware operations
 */

import type {
  MiddlewareCORSConfig,
  MiddlewareCacheConfig,
  MiddlewareRateLimitConfig,
  MiddlewareAuthConfig,
  SecurityHeadersConfig,
  IPFilterConfig,
  LogConfig,
  HealthCheckConfig,
  ErrorHandlerConfig,
} from '../entities';

// Type aliases for backwards compatibility
export type CORSConfig = MiddlewareCORSConfig;
export type CacheConfig = MiddlewareCacheConfig;
export type RateLimitConfig = MiddlewareRateLimitConfig;
export type AuthConfig = MiddlewareAuthConfig;

export interface IMiddlewareService {
  /**
   * CORS middleware
   */
  cors(request: Request, config: MiddlewareCORSConfig): Promise<Response | null>;
  addCorsHeaders(request: Request, response: Response, config: MiddlewareCORSConfig): Response;

  /**
   * Cache middleware
   */
  cache(request: Request, config: MiddlewareCacheConfig): Promise<Response | null>;
  setCache(request: Request, response: Response, config: MiddlewareCacheConfig): void;
  invalidateCache(pattern?: string): void;

  /**
   * Rate limit middleware
   */
  checkRateLimit(request: Request, config: MiddlewareRateLimitConfig): Promise<Response | null>;

  /**
   * Authentication middleware
   */
  requireAuth(request: Request, config: MiddlewareAuthConfig): Promise<Response | null>;
  addUserContext(request: Request, user: {
    id: string;
    [key: string]: unknown;
  }): Request;

  /**
   * Security headers
   */
  addSecurityHeaders(response: Response, config: SecurityHeadersConfig): Response;

  /**
   * Bot detection
   */
  detectBot(request: Request): Promise<{
    isBot: boolean;
    botType?: string;
  }>;

  /**
   * Request logging
   */
  logRequest(request: Request, config: LogConfig): Promise<void>;

  /**
   * Response time tracking
   */
  trackResponseTime(handler: () => Promise<Response>): Promise<{
    response: Response;
    duration: number;
  }>;

  /**
   * IP filter
   */
  checkIPFilter(request: Request, config: IPFilterConfig): Response | null;

  /**
   * Method override
   */
  methodOverride(request: Request): Request;

  /**
   * Request ID
   */
  addRequestID(request: Request): string;

  /**
   * Health check
   */
  healthCheck(
    env: Record<string, unknown>,
    config?: HealthCheckConfig
  ): Promise<Response>;

  /**
   * Error handling
   */
  handleMiddlewareError(error: Error, config: ErrorHandlerConfig): Response;

  /**
   * Conditional middleware
   */
  conditionalChainMiddleware(
    condition: (request: Request) => boolean,
    middleware: (request: Request) => Response | null
  ): (request: Request) => Response | null;

  /**
   * Chain middleware
   */
  chainMiddleware(
    ...middlewares: Array<(request: Request) => Response | null>
  ): (request: Request) => Response | null;

  /**
   * Chain async middleware
   */
  chainAsyncMiddleware(
    request: Request,
    ...middlewares: Array<(request: Request) => Promise<Response | null>>
  ): Promise<Response | null>;
}
