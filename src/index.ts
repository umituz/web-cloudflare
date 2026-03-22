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

// Domains
export * from "./domains/wrangler";
export * from "./domains/workers";
export * from "./domains/ai-gateway";
export * from "./domains/r2";
export * from "./domains/d1";
export * from "./domains/kv";
export * from "./domains/images";
export * from "./domains/analytics";
export * from "./domains/workflows";
export * from "./domains/middleware";

// Infrastructure - Router, Utils
export * from "./infrastructure/router";
export * from "./infrastructure/utils/helpers";
export * from "./infrastructure/constants";

// Config - Patterns and Types
export * from "./config/patterns";
export * from "./config/types";

// Presentation hooks
export * from "./presentation/hooks";
