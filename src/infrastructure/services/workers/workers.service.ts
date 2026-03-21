/**
 * Workers Service
 * @description Cloudflare Workers HTTP handler and routing
 */

import type { WorkerRequest, WorkerResponse, WorkerConfig } from "../../../domain/entities/worker.entity";
import type { Env } from "../../../domain/interfaces/services.interface";

export interface WorkerFetchOptions {
  readonly cache?: CacheControls;
  readonly cors?: CorsOptions;
  readonly timeout?: number;
}

export interface CacheControls {
  readonly maxAge?: number;
  readonly immutable?: boolean;
  readonly noCache?: boolean;
}

export interface CorsOptions {
  readonly origins?: readonly string[];
  readonly methods?: readonly string[];
  readonly headers?: readonly string[];
  readonly credentials?: boolean;
}

export interface WorkerRouteConfig {
  readonly pattern: URLPattern;
  readonly handler: (request: WorkerRequest, env?: Env) => Promise<WorkerResponse>;
}

export type WorkersMiddleware = (
  request: WorkerRequest,
  env?: Env
) => Promise<WorkerResponse | null>;

class WorkersService {
  private routes: WorkerRouteConfig[] = [];
  private middleware: WorkersMiddleware[] = [];
  private cache: Cache | null = null;

  /**
   * Register a route
   */
  route(pattern: string, handler: WorkerRouteConfig["handler"]): void {
    this.routes.push({
      pattern: new URLPattern({ pathname: pattern }),
      handler,
    });
  }

  /**
   * Add middleware
   */
  use(middleware: WorkersMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Fetch handler
   */
  async fetch(request: WorkerRequest, env?: Env, ctx?: ExecutionContext): Promise<WorkerResponse> {
    // Initialize cache
    if (!this.cache && env) {
      this.cache = caches.default;
    }

    // Try middleware
    for (const mw of this.middleware) {
      const response = await mw(request, env);
      if (response) return response;
    }

    // Match route
    const url = new URL(request.url);
    for (const route of this.routes) {
      if (route.pattern.test(url)) {
        return route.handler(request, env);
      }
    }

    // 404
    return new Response("Not Found", { status: 404 });
  }

  /**
   * JSON response helper
   */
  json(data: unknown, status = 200): WorkerResponse {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Error response helper
   */
  error(message: string, status = 500): WorkerResponse {
    return this.json({ error: message }, status);
  }

  /**
   * CORS response helper
   */
  cors(options: CorsOptions = {}): WorkerResponse {
    const headers = new Headers();

    if (options.origins) {
      const origin = options.origins.join(", ");
      headers.set("Access-Control-Allow-Origin", origin);
    }

    if (options.methods) {
      headers.set("Access-Control-Allow-Methods", options.methods.join(", "));
    }

    if (options.headers) {
      headers.set("Access-Control-Allow-Headers", options.headers.join(", "));
    }

    if (options.credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    return new Response(null, { headers });
  }

  /**
   * Cache response helper
   */
  async cached(request: Request, ttl: number, fetcher: () => Promise<Response>): Promise<Response> {
    if (!this.cache) return fetcher();

    const cacheKey = new Request(request.url, request);
    let response = await this.cache.match(cacheKey);

    if (!response) {
      response = await fetcher();
      response = new Response(response.body, response);
      response.headers.set("Cache-Control", `public, max-age=${ttl}`);
      await this.cache.put(cacheKey, response.clone());
    }

    return response;
  }

  /**
   * Redirect response helper
   */
  redirect(url: string, status = 302): WorkerResponse {
    return new Response(null, {
      status,
      headers: {
        Location: url,
      },
    });
  }
}

export const workersService = new WorkersService();
