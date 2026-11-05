
import { json, notFound } from '../utils/helpers';
import type { WorkersAIBinding } from '../../config/types';


export interface BaseEnv {
  readonly KV?: Record<string, KVNamespace>;
  readonly R2?: Record<string, R2Bucket>;
  readonly D1?: Record<string, D1Database>;
}

export interface CloudflareEnv extends BaseEnv {
  DO?: Record<string, DurableObjectNamespace>;
  QUEUE?: Record<string, Queue>;
  AI?: WorkersAIBinding;
  vars?: Record<string, string>;
}

export type Env = CloudflareEnv;


export type RouteHandler = (
  request: Request,
  params?: Record<string, string>,
  env?: CloudflareEnv,
  ctx?: ExecutionContext
) => Promise<Response> | Response;

export type Middleware = (
  request: Request,
  env?: CloudflareEnv,
  ctx?: ExecutionContext
) => Promise<Response | null> | Response | null;

export interface Route {
  method: string;
  pattern: URLPattern;
  handler: RouteHandler;
  middlewares?: Middleware[];
}


export class Router {
  private routes: Route[] = [];
  private globalMiddlewares: Middleware[] = [];
  private routeCache: Map<string, Route | null> = new Map();
  private cacheEnabled: boolean = true;
  private maxCacheSize: number = 1000;

  use(middleware: Middleware): Router {
    this.globalMiddlewares.push(middleware);
    return this;
  }

  setCacheEnabled(enabled: boolean): Router {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.routeCache.clear();
    }
    return this;
  }

  clearCache(): Router {
    this.routeCache.clear();
    return this;
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

  get(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('GET', path, handler, middlewares);
  }

  post(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('POST', path, handler, middlewares);
  }

  put(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('PUT', path, handler, middlewares);
  }

  patch(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('PATCH', path, handler, middlewares);
  }

  delete(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('DELETE', path, handler, middlewares);
  }

  head(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('HEAD', path, handler, middlewares);
  }

  options(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('OPTIONS', path, handler, middlewares);
  }

  all(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('*', path, handler, middlewares);
  }

  private addRoute(
    method: string,
    path: string,
    handler: RouteHandler,
    middlewares?: Middleware[]
  ): Router {
    const pattern = new URLPattern({ pathname: path });

    this.routes.push({
      method,
      pattern,
      handler,
      middlewares,
    });

    return this;
  }

  group(prefix: string, callback: (router: Router) => void): Router {
    const groupedRouter = new Router();
    callback(groupedRouter);

    groupedRouter.routes.forEach((route) => {
      const prefixedPath = prefix + route.pattern.pathname;
      this.routes.push({
        ...route,
        pattern: new URLPattern({ pathname: prefixedPath }),
      });
    });

    return this;
  }

  async handle(
    request: Request,
    env?: CloudflareEnv,
    ctx?: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    for (const middleware of this.globalMiddlewares) {
      const response = await middleware(request, env, ctx);
      if (response) {
        return response;
      }
    }

    const cacheKey = `${method}:${url.pathname}`;
    let matchedRoute: Route | undefined;

    if (this.cacheEnabled) {
      this.cleanupCache();
      const cachedRoute = this.routeCache.get(cacheKey);
      if (cachedRoute) {
        matchedRoute = cachedRoute;
      }
    }

    if (!matchedRoute) {
      for (const route of this.routes) {
        if (route.method !== '*' && route.method !== method) {
          continue;
        }

        const match = route.pattern.exec(url);
        if (match) {
          matchedRoute = route;
          if (this.cacheEnabled) {
            this.routeCache.set(cacheKey, route);
          }
          break;
        }
      }
    }

    if (matchedRoute) {
      const match = matchedRoute.pattern.exec(url);
      const params = this.extractParams(match || null);

      const annotatedRequest = params
        ? Object.assign(request, { __routerParams: params })
        : request;

      if (matchedRoute.middlewares) {
        for (const middleware of matchedRoute.middlewares) {
          const response = await middleware(annotatedRequest, env, ctx);
          if (response) {
            return response;
          }
        }
      }

      try {
        return await matchedRoute.handler(annotatedRequest, params, env, ctx);
      } catch (error) {
        return json(
          {
            error: error instanceof Error ? error.message : 'Internal Server Error',
          },
          500
        );
      }
    }

    if (this.cacheEnabled) {
      this.routeCache.set(cacheKey, null);
    }

    return notFound();
  }

  private extractParams(
    match: URLPatternResult | null
  ): Record<string, string> {
    if (!match) {
      return {};
    }

    const params: Record<string, string> = {};

    if (match.pathname?.groups) {
      Object.assign(params, match.pathname.groups);
    }

    return params;
  }

  getRoutes(): Array<{ method: string; path: string }> {
    return this.routes.map((route) => ({
      method: route.method,
      path: route.pattern.pathname,
    }));
  }

  clear(): Router {
    this.routes = [];
    this.globalMiddlewares = [];
    return this;
  }
}


export class RouteBuilder {
  private router: Router;

  constructor() {
    this.router = new Router();
  }

  route(method: string, path: string, handler: RouteHandler): RouteBuilder {
    switch (method.toUpperCase()) {
      case 'GET':
        this.router.get(path, handler);
        break;
      case 'POST':
        this.router.post(path, handler);
        break;
      case 'PUT':
        this.router.put(path, handler);
        break;
      case 'PATCH':
        this.router.patch(path, handler);
        break;
      case 'DELETE':
        this.router.delete(path, handler);
        break;
      case 'HEAD':
        this.router.head(path, handler);
        break;
      case 'OPTIONS':
        this.router.options(path, handler);
        break;
      default:
        this.router.all(path, handler);
    }
    return this;
  }

  use(middleware: Middleware): RouteBuilder {
    this.router.use(middleware);
    return this;
  }

  build(): Router {
    return this.router;
  }
}


export function resource(
  router: Router,
  path: string,
  controller: {
    index?: RouteHandler;
    show?: RouteHandler;
    create?: RouteHandler;
    update?: RouteHandler;
    delete?: RouteHandler;
  }
): Router {
  if (controller.index) {
    router.get(path, controller.index);
  }
  if (controller.show) {
    router.get(`${path}/:id`, controller.show);
  }
  if (controller.create) {
    router.post(path, controller.create);
  }
  if (controller.update) {
    router.put(`${path}/:id`, controller.update);
    router.patch(`${path}/:id`, controller.update);
  }
  if (controller.delete) {
    router.delete(`${path}/:id`, controller.delete);
  }
  return router;
}

export function api(
  router: Router,
  path: string,
  handlers: {
    list?: RouteHandler;
    get?: RouteHandler;
    create?: RouteHandler;
    update?: RouteHandler;
    delete?: RouteHandler;
  }
): Router {
  const basePath = path.startsWith('/') ? path : `/${path}`;

  if (handlers.list) {
    router.get(`${basePath}`, handlers.list);
  }
  if (handlers.get) {
    router.get(`${basePath}/:id`, handlers.get);
  }
  if (handlers.create) {
    router.post(`${basePath}`, handlers.create);
  }
  if (handlers.update) {
    router.put(`${basePath}/:id`, handlers.update);
    router.patch(`${basePath}/:id`, handlers.update);
  }
  if (handlers.delete) {
    router.delete(`${basePath}/:id`, handlers.delete);
  }

  return router;
}


export function combineMiddlewares(...middlewares: Middleware[]): Middleware {
  return async (request, env, ctx) => {
    for (const middleware of middlewares) {
      const response = await middleware(request, env, ctx);
      if (response) {
        return response;
      }
    }
    return null;
  };
}

export function conditionalMiddleware(
  condition: (request: Request) => boolean,
  middleware: Middleware
): Middleware {
  return async (request, env, ctx) => {
    if (condition(request)) {
      return middleware(request, env, ctx);
    }
    return null;
  };
}

export function pathMiddleware(path: string, middleware: Middleware): Middleware {
  return conditionalMiddleware(
    (request) => {
      const url = new URL(request.url);
      return url.pathname.startsWith(path);
    },
    middleware
  );
}

export function methodMiddleware(
  methods: string[],
  middleware: Middleware
): Middleware {
  return conditionalMiddleware(
    (request) => methods.includes(request.method),
    middleware
  );
}


export const send = json;

export function success(data: unknown, message?: string): Response {
  return json({
    success: true,
    ...(message && { message }),
    data,
  });
}

export function fail(error: string, status: number = 400): Response {
  return json(
    {
      success: false,
      error,
    },
    status
  );
}

export function validationError(errors: Record<string, string[]>): Response {
  return json(
    {
      success: false,
      error: 'Validation failed',
      errors,
    },
    400
  );
}


export async function body<T = unknown>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

export function query(request: Request): Record<string, string> {
  const url = new URL(request.url);
  const result: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function params(request: Request): Record<string, string> {
  const annotated = (request as Request & { __routerParams?: Record<string, string> }).__routerParams;
  return annotated ?? {};
}

export function headers(request: Request): Headers {
  return request.headers;
}

export function header(request: Request, name: string): string | null {
  return request.headers.get(name);
}

export function cookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const target = cookies.find((c) => c.startsWith(`${name}=`));

  return target ? target.substring(name.length + 1) : null;
}


export const createRouter = (): Router => new Router();

export const createBuilder = (): RouteBuilder => new RouteBuilder();
