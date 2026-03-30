/**
 * Cloudflare Worker Configuration Types
 * @description Comprehensive configuration types for Cloudflare Workers
 */

// ============================================================
// Main Configuration
// ============================================================

export interface WorkerConfig {
  /**
   * Cache configuration
   */
  cache?: CacheConfig;

  /**
   * Rate limiting configuration
   */
  rateLimit?: RateLimitConfig;

  /**
   * CORS configuration
   */
  cors?: CORSConfig;

  /**
   * AI configuration
   */
  ai?: AIConfig;

  /**
   * Vectorize configuration
   */
  vectorize?: VectorizeConfig;

  /**
   * Workflows configuration
   */
  workflows?: WorkflowConfig;

  /**
   * Analytics configuration
   */
  analytics?: AnalyticsConfig;

  /**
   * Compression configuration
   */
  compression?: CompressionConfig;

  /**
   * Image optimization configuration
   */
  imageOptimization?: ImageOptimizationConfig;

  /**
   * Queues configuration
   */
  queues?: QueueConfig;

  /**
   * Scheduled tasks configuration
   */
  scheduledTasks?: ScheduledTaskConfig;

  /**
   * Multi-tenant configuration
   */
  multiTenant?: {
    enabled: boolean;
    d1Bindings?: string[];
    r2Bindings?: string[];
    kvNamespaces?: string[];
    vectorizeIndexes?: string[];
  };

  /**
   * Static file serving configuration
   */
  staticFiles?: StaticFileConfig;

  /**
   * Proxy configuration
   */
  proxy?: ProxyConfig;

  /**
   * Security configuration
   */
  security?: SecurityConfig;

  /**
   * Monitoring configuration
   */
  monitoring?: MonitoringConfig;

  /**
   * Feature flags
   */
  features?: FeatureFlags;
}

// ============================================================
// Cache Configuration
// ============================================================

export interface CacheConfig {
  /**
   * Enable caching
   */
  enabled: boolean;

  /**
   * Default TTL in seconds
   */
  defaultTTL: number;

  /**
   * Path-specific TTLs
   */
  paths?: Record<string, number>;

  /**
   * Cache key prefix
   */
  prefix?: string;

  /**
   * Bypass cache for these paths
   */
  bypassPaths?: string[];

  /**
   * Cache headers to respect
   */
  respectHeaders?: boolean;
}

// ============================================================
// Rate Limiting Configuration
// ============================================================

export interface RateLimitConfig {
  /**
   * Enable rate limiting
   */
  enabled: boolean;

  /**
   * Max requests per window
   */
  maxRequests: number;

  /**
   * Time window in seconds
   */
  window: number;

  /**
   * Rate limit by IP, user, or both
   */
  by?: 'ip' | 'user' | 'both';

  /**
   * Custom rate limit keys
   */
  customKeys?: string[];

  /**
   * Whitelisted IPs/IDs
   */
  whitelist?: string[];

  /**
   * Response when rate limited
   */
  response?: {
    status: number;
    message: string;
    retryAfter?: number;
  };
}

// ============================================================
// CORS Configuration
// ============================================================

export interface CORSConfig {
  /**
   * Enable CORS
   */
  enabled: boolean;

  /**
   * Allowed origins
   */
  allowedOrigins: string[];

  /**
   * Allowed methods
   */
  allowedMethods: string[];

  /**
   * Allowed headers
   */
  allowedHeaders: string[];

  /**
   * Exposed headers
   */
  exposedHeaders?: string[];

  /**
   * Allow credentials
   */
  allowCredentials?: boolean;

  /**
   * Max age for preflight
   */
  maxAge?: number;
}

// ============================================================
// AI Configuration
// ============================================================

export interface AIConfig {
  /**
   * Enable AI features
   */
  enabled: boolean;

  /**
   * AI Gateway configuration
   */
  gateway?: {
    gatewayId?: string;
    providers: Array<{
      id: string;
      name: string;
      type: 'workers-ai' | 'openai' | 'anthropic' | 'cohere' | 'custom';
      baseURL: string;
      apiKey: string;
      models: string[];
      fallbackProvider?: string;
      weight?: number;
      pricing?: Record<string, {
        inputCostPer1KTokens: number;
        outputCostPer1KTokens: number;
        neuronsPer1KTokens?: number;
      }>;
    }>;
    cacheEnabled?: boolean;
    cacheTTL?: number;
    rateLimiting?: boolean;
    analytics?: boolean;
    budget?: {
      monthlyLimit: number;
      alertThreshold: number;
    };
  };

  /**
   * Default model for text generation
   */
  defaultModel?: string;

  /**
   * Default parameters
   */
  defaultParams?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };

  /**
   * Neuron quota configuration
   */
  neuronQuota?: {
    enabled: boolean;
    quota: number;
    period: number;
  };
}

// ============================================================
// Vectorize Configuration
// ============================================================

export interface VectorizeConfig {
  /**
   * Enable Vectorize
   */
  enabled: boolean;

  /**
   * Vectorize index names
   */
  indexes: string[];

  /**
   * Default dimensions for embeddings
   */
  defaultDimensions: number;

  /**
   * Distance metric
   */
  metric: 'cosine' | 'euclidean' | 'dotproduct';
}

// ============================================================
// Workflow Configuration
// ============================================================

export interface WorkflowConfig {
  /**
   * Enable workflows
   */
  enabled: boolean;

  /**
   * Max execution time in seconds
   */
  maxExecutionTime: number;

  /**
   * Default retry count
   */
  defaultRetries: number;

  /**
   * Workflow definitions
   */
  workflows?: Record<string, {
    id: string;
    name: string;
    description?: string;
    steps: Array<{
      id: string;
      name: string;
      handler: string;
      timeout?: number;
      retryPolicy?: {
        maxAttempts: number;
        backoffMultiplier: number;
        initialDelay: number;
        maxDelay: number;
      };
      dependencies?: string[];
    }>;
  }>;

  /**
   * Storage backend for workflow state
   */
  storage?: 'kv' | 'd1';
}

// ============================================================
// Analytics Configuration
// ============================================================

export interface AnalyticsConfig {
  /**
   * Enable analytics
   */
  enabled: boolean;

  /**
   * Analytics provider
   */
  provider?: 'cloudflare' | 'google' | 'mixpanel' | 'custom';

  /**
   * Sample rate (0-1)
   */
  sampleRate?: number;

  /**
   * Events to track
   */
  events?: string[];

  /**
   * Custom analytics endpoint
   */
  endpoint?: string;

  /**
   * Track AI usage
   */
  trackAIUsage?: boolean;

  /**
   * Track AI costs
   */
  trackCosts?: boolean;
}

// ============================================================
// Compression Configuration
// ============================================================

export interface CompressionConfig {
  /**
   * Enable compression
   */
  enabled: boolean;

  /**
   * Content types to compress
   */
  types?: string[];

  /**
   * Minimum size to compress (bytes)
   */
  minSize?: number;

  /**
   * Compression level (0-9)
   */
  level?: number;
}

// ============================================================
// Image Optimization Configuration
// ============================================================

export interface ImageOptimizationConfig {
  /**
   * Enable image optimization
   */
  enabled: boolean;

  /**
   * Supported formats
   */
  formats?: Array<'webp' | 'avif' | 'jpeg' | 'png'>;

  /**
   * Default quality (1-100)
   */
  quality?: number;

  /**
   * Default resize options
   */
  resize?: {
    maxWidth?: number;
    maxHeight?: number;
    fit?: 'contain' | 'cover' | 'fill';
  };

  /**
   * Strip metadata
   */
  stripMetadata?: boolean;
}

// ============================================================
// Queue Configuration
// ============================================================

export interface QueueConfig {
  /**
   * Enable queues
   */
  enabled: boolean;

  /**
   * Queue definitions
   */
  queues?: Record<string, {
    name: string;
    batchSize?: number;
    maxRetries?: number;
    maxWaitTime?: number;
  }>;
}

// ============================================================
// Scheduled Task Configuration
// ============================================================

export interface ScheduledTaskConfig {
  /**
   * Enable scheduled tasks
   */
  enabled: boolean;

  /**
   * Cron schedules
   */
  schedules?: Record<string, {
    cron: string;
    handler: string;
  }>;
}

// ============================================================
// Static File Configuration
// ============================================================

export interface StaticFileConfig {
  /**
   * Enable static file serving
   */
  enabled: boolean;

  /**
   * Path patterns for static files
   */
  paths?: string[];

  /**
   * Cache control header
   */
  cacheControl?: string;

  /**
   * Serve index.html for directory requests
   */
  serveIndex?: boolean;

  /**
   * Custom headers
   */
  headers?: Record<string, string>;
}

// ============================================================
// Proxy Configuration
// ============================================================

export interface ProxyConfig {
  /**
   * Enable proxying
   */
  enabled: boolean;

  /**
   * Upstream URL
   */
  upstream: string;

  /**
   * Paths to proxy
   */
  paths?: string[];

  /**
   * Strip request headers
   */
  stripHeaders?: string[];

  /**
   * Add request headers
   */
  addHeaders?: Record<string, string>;

  /**
   * Timeout in seconds
   */
  timeout?: number;

  /**
   * Retry attempts
   */
  retries?: number;
}

// ============================================================
// Security Configuration
// ============================================================

export interface SecurityConfig {
  /**
   * Enable security headers
   */
  enabled: boolean;

  /**
   * Security headers
   */
  headers?: {
    XFrameOptions?: string;
    XContentTypeOptions?: string;
    XSSProtection?: string;
    ContentSecurityPolicy?: string;
    StrictTransportSecurity?: string;
    ReferrerPolicy?: string;
    PermissionsPolicy?: string;
  };

  /**
   * Bot detection
   */
  botDetection?: boolean;

  /**
   * IP whitelist/blacklist
   */
  ipFilter?: {
    mode: 'whitelist' | 'blacklist';
    ips: string[];
  };
}

// ============================================================
// Monitoring Configuration
// ============================================================

export interface MonitoringConfig {
  /**
   * Enable monitoring
   */
  enabled: boolean;

  /**
   * Log level
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Trace sampling (0-1)
   */
  traceSampleRate?: number;

  /**
   * Error tracking endpoint
   */
  errorEndpoint?: string;

  /**
   * Performance monitoring
   */
  performance?: boolean;

  /**
   * Alert thresholds
   */
  alerts?: {
    errorRate?: number;
    latency?: number;
  };
}

// ============================================================
// Feature Flags
// ============================================================

export interface FeatureFlags {
  /**
   * Enable new features
   */
  [key: string]: boolean | string | number | undefined;
}

// ============================================================
// Environment Configuration
// ============================================================

export interface EnvConfig {
  /**
   * Environment name
   */
  environment: 'development' | 'staging' | 'production';

  /**
   * KV namespace bindings
   */
  KV?: KVNamespace;

  /**
   * R2 bucket bindings
   */
  R2?: R2Bucket;

  /**
   * D1 database bindings
   */
  D1?: D1Database;

  /**
   * Durable Object bindings
   */
  DO?: Record<string, DurableObjectNamespace>;

  /**
   * Queue bindings
   */
  QUEUE?: Record<string, Queue>;

  /**
   * AI bindings
   */
  AI?: WorkersAIBinding;

  /**
   * Custom environment variables
   */
  vars?: Record<string, string>;
}

/**
 * Workers AI Binding
 * @description Cloudflare Workers AI runtime binding
 */
export interface WorkersAIBinding {
  run: <T = unknown>(model: string, inputs: Record<string, unknown>) => Promise<T>;
}

// ============================================================
// Configuration Merging Types
// ============================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ConfigOverride = DeepPartial<WorkerConfig>;
