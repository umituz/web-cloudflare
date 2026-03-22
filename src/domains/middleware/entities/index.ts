/**
 * Middleware Domain Entities
 * @description Middleware configuration and types for Cloudflare Workers
 */

/**
 * CORS configuration
 */
export interface CORSConfig {
  enabled: boolean;
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  defaultTTL: number;
  paths?: Record<string, number>;
  prefix?: string;
  bypassPaths?: string[];
  respectHeaders?: boolean;
}

/**
 * Rate limit configuration
 */
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

/**
 * Authentication configuration
 */
export interface AuthConfig {
  enabled: boolean;
  type: 'bearer' | 'apikey' | 'basic';
  token?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
  username?: string;
  password?: string;
}

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  frameGuard?: boolean;
  contentTypeNosniff?: boolean;
  xssProtection?: boolean;
  strictTransportSecurity?: boolean;
  referrerPolicy?: string;
  contentSecurityPolicy?: string;
}

/**
 * IP filter configuration
 */
export interface IPFilterConfig {
  mode: 'whitelist' | 'blacklist';
  ips: string[];
  cidrs?: string[];
}

/**
 * Log configuration
 */
export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  includeHeaders?: boolean;
  includeBody?: boolean;
  sampleRate?: number;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  uptime: number;
  checks: Record<string, () => Promise<boolean>>;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  debug: boolean;
  logger?: (error: Error) => void;
}
