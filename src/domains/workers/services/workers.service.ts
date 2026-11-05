
import type { WorkerRequest, WorkerResponse } from "../entities";
import type { Env } from "../types";

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
  private routeCache: Map<string, WorkerRouteConfig | null> = new Map();
  private maxCacheSize: number = 1000;

  route(pattern: string, handler: WorkerRouteConfig["handler"]): void {
    this.routes.push({
      pattern: new URLPattern({ pathname: pattern }),
      handler,
    });
    this.routeCache.clear();
  }

  use(middleware: WorkersMiddleware): void {
    this.middleware.push(middleware);
  }

  private cleanupCache(): void {
    if (this.routeCache.size > this.maxCacheSize) {
      const entriesToDelete = Math.floor(this.maxCacheSize * 0.5);
      let deleted = 0;
      for (const key of this.routeCache.keys()) {
        if (deleted >= entriesToDelete) break;
        this.routeCache.delete(key);
        deleted++;
      }
    }
  }

  async fetch(request: WorkerRequest, env?: Env, _ctx?: ExecutionContext): Promise<WorkerResponse> {
    if (!this.cache && env && typeof caches !== 'undefined') {
      type CachesWithDefault = typeof caches & { default?: Cache };
      const cacheDefault = (caches as CachesWithDefault).default;
      this.cache = cacheDefault ?? null;
    }

    for (const mw of this.middleware) {
      const response = await mw(request, env);
      if (response) return response;
    }

    const url = new URL(request.url);
    const cacheKey = `${request.method}:${url.pathname}`;

    this.cleanupCache();

    let matchedRoute = this.routeCache.get(cacheKey);
    if (matchedRoute === undefined) {
      for (const route of this.routes) {
        if (route.pattern.test(url)) {
          matchedRoute = route;
          this.routeCache.set(cacheKey, route);
          break;
        }
      }

      if (matchedRoute === undefined) {
        this.routeCache.set(cacheKey, null);
      }
    }

    if (matchedRoute) {
      return matchedRoute.handler(request, env);
    }

    return new Response("Not Found", { status: 404 });
  }

  json(data: unknown, status = 200): WorkerResponse {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  error(message: string, status = 500): WorkerResponse {
    return this.json({ error: message }, status);
  }

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

  redirect(url: string, status = 302): WorkerResponse {
    return new Response(null, {
      status,
      headers: {
        Location: url,
      },
    });
  }
}

export { WorkersService };
export const workersService = new WorkersService();
