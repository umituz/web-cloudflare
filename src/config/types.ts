

export interface WorkerConfig {
  cache?: CacheConfig;

  rateLimit?: RateLimitConfig;

  cors?: CORSConfig;

  ai?: AIConfig;

  vectorize?: VectorizeConfig;

  workflows?: WorkflowConfig;

  analytics?: AnalyticsConfig;

  compression?: CompressionConfig;

  imageOptimization?: ImageOptimizationConfig;

  queues?: QueueConfig;

  scheduledTasks?: ScheduledTaskConfig;

  multiTenant?: {
    enabled: boolean;
    d1Bindings?: string[];
    r2Bindings?: string[];
    kvNamespaces?: string[];
    vectorizeIndexes?: string[];
  };

  staticFiles?: StaticFileConfig;

  proxy?: ProxyConfig;

  security?: SecurityConfig;

  monitoring?: MonitoringConfig;

  features?: FeatureFlags;
}


export interface CacheConfig {
  enabled: boolean;

  defaultTTL: number;

  paths?: Record<string, number>;

  prefix?: string;

  bypassPaths?: string[];

  respectHeaders?: boolean;
}


export interface RateLimitConfig {
  enabled: boolean;

  maxRequests: number;

  window: number;

  by?: 'ip' | 'user' | 'both';

  customKeys?: string[];

  whitelist?: string[];

  response?: {
    status: number;
    message: string;
    retryAfter?: number;
  };
}


export interface CORSConfig {
  enabled: boolean;

  allowedOrigins: string[];

  allowedMethods: string[];

  allowedHeaders: string[];

  exposedHeaders?: string[];

  allowCredentials?: boolean;

  maxAge?: number;
}


export interface AIConfig {
  enabled: boolean;

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

  defaultModel?: string;

  defaultParams?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };

  neuronQuota?: {
    enabled: boolean;
    quota: number;
    period: number;
  };

  huggingface?: {
    enabled: boolean;
    accountId?: string;
    defaultGatewayId?: string;
    models?: string[];
  };
}


export interface VectorizeConfig {
  enabled: boolean;

  indexes: string[];

  defaultDimensions: number;

  metric: 'cosine' | 'euclidean' | 'dotproduct';
}


export interface WorkflowConfig {
  enabled: boolean;

  maxExecutionTime: number;

  defaultRetries: number;

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

  storage?: 'kv' | 'd1';
}


export interface AnalyticsConfig {
  enabled: boolean;

  provider?: 'cloudflare' | 'google' | 'mixpanel' | 'custom';

  sampleRate?: number;

  events?: string[];

  endpoint?: string;

  trackAIUsage?: boolean;

  trackCosts?: boolean;
}


export interface CompressionConfig {
  enabled: boolean;

  types?: string[];

  minSize?: number;

  level?: number;
}


export interface ImageOptimizationConfig {
  enabled: boolean;

  formats?: Array<'webp' | 'avif' | 'jpeg' | 'png'>;

  quality?: number;

  resize?: {
    maxWidth?: number;
    maxHeight?: number;
    fit?: 'contain' | 'cover' | 'fill';
  };

  stripMetadata?: boolean;
}


export interface QueueConfig {
  enabled: boolean;

  queues?: Record<string, {
    name: string;
    batchSize?: number;
    maxRetries?: number;
    maxWaitTime?: number;
  }>;
}


export interface ScheduledTaskConfig {
  enabled: boolean;

  schedules?: Record<string, {
    cron: string;
    handler: string;
  }>;
}


export interface StaticFileConfig {
  enabled: boolean;

  paths?: string[];

  cacheControl?: string;

  serveIndex?: boolean;

  headers?: Record<string, string>;
}


export interface ProxyConfig {
  enabled: boolean;

  upstream: string;

  paths?: string[];

  stripHeaders?: string[];

  addHeaders?: Record<string, string>;

  timeout?: number;

  retries?: number;
}


export interface SecurityConfig {
  enabled: boolean;

  headers?: {
    XFrameOptions?: string;
    XContentTypeOptions?: string;
    XSSProtection?: string;
    ContentSecurityPolicy?: string;
    StrictTransportSecurity?: string;
    ReferrerPolicy?: string;
    PermissionsPolicy?: string;
  };

  botDetection?: boolean;

  ipFilter?: {
    mode: 'whitelist' | 'blacklist';
    ips: string[];
  };
}


export interface MonitoringConfig {
  enabled: boolean;

  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  traceSampleRate?: number;

  errorEndpoint?: string;

  performance?: boolean;

  alerts?: {
    errorRate?: number;
    latency?: number;
  };
}


export interface FeatureFlags {
  [key: string]: boolean | string | number | undefined;
}


export interface EnvConfig {
  environment: 'development' | 'staging' | 'production';

  KV?: KVNamespace;

  R2?: R2Bucket;

  D1?: D1Database;

  DO?: Record<string, DurableObjectNamespace>;

  QUEUE?: Record<string, Queue>;

  AI?: WorkersAIBinding;

  vars?: Record<string, string>;
}

export interface WorkersAIBinding {
  run: <T = unknown>(model: string, inputs: Record<string, unknown>) => Promise<T>;
}

export type Ai = WorkersAIBinding;


export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ConfigOverride = DeepPartial<WorkerConfig>;
