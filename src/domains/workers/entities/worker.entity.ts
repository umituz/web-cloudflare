/**
 * Worker Entity
 * @description Basic Worker entity placeholder
 */

export interface WorkerEntity {
  id: string;
  name: string;
}

export interface WorkerConfig {
  name: string;
  routes?: string[];
  schedule?: string;
  bindings?: Record<string, unknown>;
}

export interface WorkerResponse {
  status: number;
  body?: BodyInit | null;
}

export interface IncomingRequestCfProperties {
  colo?: string;
  country?: string;
  httpProtocol?: string;
  tlsVersion?: string;
  tlsCipher?: string;
  asn?: number;
  requestPriority?: number;
}

export interface WorkerRequest {
  url: string;
  method: string;
  headers: Headers;
  body?: ReadableStream | null;
  json(): Promise<unknown>;
  cf?: IncomingRequestCfProperties;
}

export interface CloudflareWorkerConfig extends WorkerConfig {
  env?: {
    KV?: Record<string, KVNamespace>;
    R2?: Record<string, R2Bucket>;
    D1?: Record<string, D1Database>;
  };
}

// Workflow types
export interface WorkflowStep<T = unknown> {
  id: string;
  name: string;
  handler: string | ((input: T) => Promise<unknown>);
  inputs?: Record<string, unknown>;
  dependencies?: string[];
  timeout?: number;
  retryPolicy?: {
    maxAttempts?: number;
    backoffMs?: number;
    backoffMultiplier?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

export interface WorkflowDefinition<TInput = unknown, TOutput = unknown> {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  steps: WorkflowStep<TInput>[];
  execute?: (input: TInput) => Promise<TOutput>;
  retryConfig?: {
    maxRetries?: number;
    backoffMultiplier?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  input: unknown;
  inputs?: Record<string, unknown>;
  output?: unknown;
  outputs?: Record<string, unknown>;
  startedAt: number;
  completedAt?: number;
  completedSteps: string[];
  failedSteps: string[];
  error?: Error | string;
  retryCount: number;
}

export interface CloudflareWorkflowConfig {
  kvBinding?: string;
  d1Binding?: string;
  maxExecutionTime?: number;
}

// Middleware config types
export interface MiddlewareCORSConfig {
  enabled?: boolean;
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  allowCredentials?: boolean;
  maxAge?: number;
}

export interface MiddlewareCacheConfig {
  enabled: boolean;
  defaultTTL: number;
  staleWhileRevalidate?: boolean;
  prefix?: string;
  bypassPaths?: string[];
  paths?: Record<string, number>;
}

export interface MiddlewareRateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  window: number;
  by?: 'ip' | 'user' | 'custom' | 'both';
  keyGenerator?: (request: Request) => string;
  customKeys?: string[];
  whitelist?: string[];
  response?: {
    status: number;
    body: string;
    message?: string;
    headers?: Record<string, string>;
  };
}

export interface MiddlewareAuthConfig {
  enabled?: boolean;
  type: 'bearer' | 'basic' | 'custom' | 'apikey';
  validate: (request: Request) => Promise<boolean>;
  validateToken?: (token: string) => Promise<boolean>;
  challenge?: (request: Request) => Response;
  token?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
  username?: string;
  password?: string;
}

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
  strictTransportSecurity?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: 'nosniff' | string;
}

export interface IPFilterConfig {
  allowed: string[];
  blocked: string[];
}

export interface LogConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  includeHeaders?: boolean;
  includeBody?: boolean;
}

export interface HealthCheckConfig {
  path: string;
  methods: string[];
  response: { status: number; body?: string };
}

export interface ErrorHandlerConfig {
  includeStackTrace?: boolean;
  sanitizeErrors?: boolean;
}
