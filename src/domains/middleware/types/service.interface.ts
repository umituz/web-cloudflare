
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

export interface IMiddlewareService {
  cors(request: Request, config: MiddlewareCORSConfig): Promise<Response | null>;
  addCorsHeaders(request: Request, response: Response, config: MiddlewareCORSConfig): Response;

  cache(request: Request, config: MiddlewareCacheConfig): Promise<Response | null>;
  setCache(request: Request, response: Response, config: MiddlewareCacheConfig): void;
  invalidateCache(pattern?: string): void;

  checkRateLimit(request: Request, config: MiddlewareRateLimitConfig): Promise<Response | null>;

  requireAuth(request: Request, config: MiddlewareAuthConfig): Promise<Response | null>;
  addUserContext(request: Request, user: {
    id: string;
    [key: string]: unknown;
  }): Request;

  addSecurityHeaders(response: Response, config: SecurityHeadersConfig): Response;

  detectBot(request: Request): Promise<{
    isBot: boolean;
    botType?: string;
  }>;

  logRequest(request: Request, config: LogConfig): Promise<void>;

  trackResponseTime(handler: () => Promise<Response>): Promise<{
    response: Response;
    duration: number;
  }>;

  checkIPFilter(request: Request, config: IPFilterConfig): Response | null;

  methodOverride(request: Request): Request;

  addRequestID(request: Request): string;

  healthCheck(
    env: Record<string, unknown>,
    config?: HealthCheckConfig
  ): Promise<Response>;

  handleMiddlewareError(error: Error, config: ErrorHandlerConfig): Response;

  conditionalChainMiddleware(
    condition: (request: Request) => boolean,
    middleware: (request: Request) => Response | null
  ): (request: Request) => Response | null;

  chainMiddleware(
    ...middlewares: Array<(request: Request) => Response | null>
  ): (request: Request) => Response | null;

  chainAsyncMiddleware(
    request: Request,
    ...middlewares: Array<(request: Request) => Promise<Response | null>>
  ): Promise<Response | null>;
}
