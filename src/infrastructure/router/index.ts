/**
 * Cloudflare Worker Router
 * @description Express-like router for Cloudflare Workers
 */

import { json, notFound, badRequest } from '../utils/helpers';

// ============================================================
// Route Handler Types
// ============================================================

export type RouteHandler = (
  request: Request,
  params?: Record<string, string>,
  env?: Env,
  ctx?: ExecutionContext
) => Promise<Response> | Response;

export type Middleware = (
  request: Request,
  env?: Env,
  ctx?: ExecutionContext
) => Promise<Response | null> | Response | null;

export interface Route {
  method: string;
  pattern: URLPattern;
  handler: RouteHandler;
  middlewares?: Middleware[];
}

// ============================================================
// Router Class
// ============================================================

export class Router {
  private routes: Route[] = [];
  private globalMiddlewares: Middleware[] = [];

  /**
   * Add global middleware
   */
  use(middleware: Middleware): Router {
    this.globalMiddlewares.push(middleware);
    return this;
  }

  /**
   * Add GET route
   */
  get(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('GET', path, handler, middlewares);
  }

  /**
   * Add POST route
   */
  post(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('POST', path, handler, middlewares);
  }

  /**
   * Add PUT route
   */
  put(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('PUT', path, handler, middlewares);
  }

  /**
   * Add PATCH route
   */
  patch(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('PATCH', path, handler, middlewares);
  }

  /**
   * Add DELETE route
   */
  delete(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('DELETE', path, handler, middlewares);
  }

  /**
   * Add HEAD route
   */
  head(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('HEAD', path, handler, middlewares);
  }

  /**
   * Add OPTIONS route
   */
  options(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('OPTIONS', path, handler, middlewares);
  }

  /**
   * Add route for any method
   */
  all(path: string, handler: RouteHandler, middlewares?: Middleware[]): Router {
    return this.addRoute('*', path, handler, middlewares);
  }

  /**
   * Add route
   */
  private addRoute(
    method: string,
    path: string,
    handler: RouteHandler,
    middlewares?: Middleware[]
  ): Router {
    // Convert path pattern to URLPattern
    const pattern = new URLPattern({ pathname: path });

    this.routes.push({
      method,
      pattern,
      handler,
      middlewares,
    });

    return this;
  }

  /**
   * Group routes with prefix
   */
  group(prefix: string, callback: (router: Router) => void): Router {
    const groupedRouter = new Router();
    callback(groupedRouter);

    // Add all routes from grouped router with prefix
    groupedRouter.routes.forEach((route) => {
      const prefixedPath = prefix + route.pattern.pathname;
      this.routes.push({
        ...route,
        pattern: new URLPattern({ pathname: prefixedPath }),
      });
    });

    return this;
  }

  /**
   * Handle request
   */
  async handle(
    request: Request,
    env?: Env,
    ctx?: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Run global middlewares
    for (const middleware of this.globalMiddlewares) {
      const response = await middleware(request, env, ctx);
      if (response) {
        return response;
      }
    }

    // Find matching route
    for (const route of this.routes) {
      // Check method (wildcard matches all)
      if (route.method !== '*' && route.method !== method) {
        continue;
      }

      // Check path pattern
      const match = route.pattern.exec(url);
      if (!match) {
        continue;
      }

      // Extract params
      const params = this.extractParams(match);

      // Run route middlewares
      if (route.middlewares) {
        for (const middleware of route.middlewares) {
          const response = await middleware(request, env, ctx);
          if (response) {
            return response;
          }
        }
      }

      // Run handler
      try {
        return await route.handler(request, params, env, ctx);
      } catch (error) {
        return json(
          {
            error: error instanceof Error ? error.message : 'Internal Server Error',
          },
          500
        );
      }
    }

    // No route matched
    return notFound();
  }

  /**
   * Extract params from URLPattern result
   */
  private extractParams(
    match: URLPatternResult | null
  ): Record<string, string> {
    if (!match) {
      return {};
    }

    const params: Record<string, string> = {};

    // Extract pathname groups
    if (match.pathname?.groups) {
      Object.assign(params, match.pathname.groups);
    }

    return params;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Array<{ method: string; path: string }> {
    return this.routes.map((route) => ({
      method: route.method,
      path: route.pattern.pathname,
    }));
  }

  /**
   * Clear all routes
   */
  clear(): Router {
    this.routes = [];
    this.globalMiddlewares = [];
    return this;
  }
}

// ============================================================
// Route Builder (Fluent API)
// ============================================================

export class RouteBuilder {
  private router: Router;

  constructor() {
    this.router = new Router();
  }

  /**
   * Define route with fluent API
   */
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

  /**
   * Add middleware
   */
  use(middleware: Middleware): RouteBuilder {
    this.router.use(middleware);
    return this;
  }

  /**
   * Get router instance
   */
  build(): Router {
    return this.router;
  }
}

// ============================================================
// Controller Helpers
// ============================================================

/**
 * Create resource routes (CRUD)
 */
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

/**
 * Create API routes
 */
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

// ============================================================
// Middleware Helpers
// ============================================================

/**
 * Combine multiple middlewares
 */
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

/**
 * Create conditional middleware
 */
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

/**
 * Create path-specific middleware
 */
export function pathMiddleware(path: string, middleware: Middleware): Middleware {
  return conditionalMiddleware(
    (request) => {
      const url = new URL(request.url);
      return url.pathname.startsWith(path);
    },
    middleware
  );
}

/**
 * Create method-specific middleware
 */
export function methodMiddleware(
  methods: string[],
  middleware: Middleware
): Middleware {
  return conditionalMiddleware(
    (request) => methods.includes(request.method),
    middleware
  );
}

// ============================================================
// Response Helpers
// ============================================================

/**
 * Send JSON response
 */
export const send = json;

/**
 * Send success response
 */
export function success(data: unknown, message?: string): Response {
  return json({
    success: true,
    ...(message && { message }),
    data,
  });
}

/**
 * Send error response
 */
export function fail(error: string, status: number = 400): Response {
  return json(
    {
      success: false,
      error,
    },
    status
  );
}

/**
 * Send validation error
 */
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

// ============================================================
// Request Helpers
// ============================================================

/**
 * Get request body as JSON
 */
export async function body<T = unknown>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

/**
 * Get query params
 */
export function query(request: Request): Record<string, string> {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

/**
 * Get path params
 */
export function params(request: Request): Record<string, string> {
  // This should be called from within a route handler
  // and relies on the router passing params
  return {};
}

/**
 * Get headers
 */
export function headers(request: Request): Headers {
  return request.headers;
}

/**
 * Get header value
 */
export function header(request: Request, name: string): string | null {
  return request.headers.get(name);
}

/**
 * Get cookie value
 */
export function cookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const target = cookies.find((c) => c.startsWith(`${name}=`));

  return target ? target.substring(name.length + 1) : null;
}

// ============================================================
// Export shorthand
// ============================================================

export const createRouter = (): Router => new Router();

export const createBuilder = (): RouteBuilder => new RouteBuilder();
