/**
 * @umituz/web-cloudflare
 * Comprehensive Cloudflare Workers integration with config-based patterns
 *
 * ONEMLI: App'ler bu root barrel'i kullanMAMALI.
 * Subpath import kullanin: "@umituz/web-cloudflare/workers"
 *
 * Available subpath exports:
 * - ./workers - Workers service
 * - ./kv - KV cache service
 * - ./r2 - R2 storage service
 * - ./d1 - D1 database service
 * - ./images - Images optimization service
 * - ./analytics - Analytics service
 * - ./workflows - Workflows orchestration service
 * - ./ai-gateway - AI Gateway service
 * - ./workers-ai - Workers AI service
 * - ./wrangler - Wrangler CLI service
 * - ./router - Express-like router
 * - ./middleware - Middleware collection
 * - ./utils - Utility helpers
 * - ./helpers - Helper functions (alias for ./utils)
 * - ./config - Configuration patterns
 * - ./patterns - Configuration patterns (alias for ./config)
 * - ./types - TypeScript types
 */

// Domains - selective exports to avoid conflicts
// NOTE: Wrangler service is Node.js-only and not exported for Workers runtime
export { workersService, WorkersService } from "./domains/workers";
export * from "./domains/ai-gateway";
export { r2Service, R2Service } from "./domains/r2";
export { d1Service, D1Service } from "./domains/d1";
export { kvService, KVService } from "./domains/kv";
export { imagesService, ImagesService } from "./domains/images";
export { analyticsService, AnalyticsService } from "./domains/analytics";
// Pages - Node.js-only service
export { pagesService, PagesService } from "./domains/pages";
// Wrangler - Node.js-only service
export { wranglerService, WranglerService } from "./domains/wrangler";
export type {
  PagesProject,
  PagesDeployment,
  PagesDeployOptions,
  PagesFunction,
  PagesDeploymentResult,
} from "./domains/pages";
// Workflows - selective exports to avoid conflicts
export type {
  WorkflowStep,
  WorkflowDefinition,
  WorkflowExecution,
  CloudflareWorkflowConfig,
} from "./domains/workflows";
export {
  workflowService,
  WorkflowService,
} from "./domains/workflows";
// Middleware - selective exports to avoid conflicts
export type {
  MiddlewareCORSConfig,
  MiddlewareCacheConfig,
  MiddlewareRateLimitConfig,
  MiddlewareAuthConfig,
  SecurityHeadersConfig,
  IPFilterConfig,
  LogConfig,
  HealthCheckConfig,
  ErrorHandlerConfig,
} from "./domains/middleware";
export {
  cors,
  addCorsHeaders,
  cache,
  setCache,
  invalidateCache,
  checkRateLimit,
  requireAuth,
  addUserContext,
} from "./domains/middleware";

// Infrastructure - Router, Utils
export * from "./infrastructure/router";
export * from "./infrastructure/utils/helpers";
export * from "./infrastructure/constants";

// Config - Patterns and Types
export * from "./config/patterns";
export * from "./config/types";

// Note: Presentation hooks are React-specific and not included in Workers runtime
// Use them in a separate React client package instead
