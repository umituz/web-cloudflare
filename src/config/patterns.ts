/**
 * Cloudflare Config Patterns
 * @description Reusable configuration patterns for different use cases
 */

import type { AIGatewayConfig } from '../domains/ai-gateway/entities';
import type { WorkflowDefinition } from '../domains/workflows/entities';
import type { WorkerConfig } from './types';

// ============================================================
// Pre-built Configurations
// ============================================================

/**
 * Social Media App Configuration
 */
export const socialMediaConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 300, // 5 minutes
    paths: {
      '/api/posts': 3600,      // 1 hour
      '/api/feed': 1800,       // 30 minutes
      '/api/trending': 600,    // 10 minutes
    },
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    window: 60,
  },
  ai: {
    enabled: true,
    gateway: {
      providers: [
        {
          id: 'workers-ai',
          name: 'Workers AI',
          type: 'workers-ai',
          baseURL: '',
          apiKey: '',
          models: ['@cf/meta/llama-3.1-8b-instruct'],
          weight: 2,
        },
      ],
      cacheEnabled: true,
      cacheTTL: 3600,
      analytics: true,
    },
  },
  workflows: {
    enabled: true,
    maxExecutionTime: 600,
    defaultRetries: 3,
  },
};

/**
 * E-commerce App Configuration
 */
export const ecommerceConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 60, // 1 minute
    paths: {
      '/api/products': 300,     // 5 minutes
      '/api/categories': 3600,  // 1 hour
      '/api/cart': 0,           // No cache
    },
  },
  rateLimit: {
    enabled: true,
    maxRequests: 200,
    window: 60,
  },
  ai: {
    enabled: false,
  },
  workflows: {
    enabled: true,
    maxExecutionTime: 300,
    defaultRetries: 2,
  },
};

/**
 * SaaS App Configuration
 */
export const saasConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 300,
    paths: {
      '/api/subscriptions': 60,
      '/api/pricing': 3600,
      '/api/features': 3600,
    },
  },
  rateLimit: {
    enabled: true,
    maxRequests: 50,
    window: 60,
  },
  ai: {
    enabled: true,
  },
  workflows: {
    enabled: true,
    maxExecutionTime: 300,
    defaultRetries: 2,
  },
};

/**
 * API Gateway Configuration
 */
export const apiGatewayConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 60,
  },
  rateLimit: {
    enabled: true,
    maxRequests: 1000,
    window: 60,
  },
  cors: {
    enabled: true,
    allowedOrigins: ['*'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    maxAge: 86400,
  },
  analytics: {
    enabled: true,
  },
};

/**
 * CDN Configuration
 */
export const cdnConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 86400, // 24 hours
    paths: {
      '/static/*': 86400,
      '/assets/*': 86400,
      '/images/*': 86400,
    },
  },
  rateLimit: {
    enabled: false,
    maxRequests: 0,
    window: 0,
  },
  compression: {
    enabled: true,
    types: ['text/*', 'application/json', 'application/javascript'],
  },
  imageOptimization: {
    enabled: true,
    formats: ['webp', 'avif'],
    quality: 80,
  },
};

/**
 * AI-First App Configuration
 */
export const aiFirstConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 300,
  },
  rateLimit: {
    enabled: true,
    maxRequests: 30,
    window: 60,
  },
  ai: {
    enabled: true,
    gateway: {
      providers: [
        {
          id: 'workers-ai',
          name: 'Workers AI',
          type: 'workers-ai',
          baseURL: '',
          apiKey: '',
          models: ['@cf/meta/llama-3.1-8b-instruct'],
          weight: 2,
        },
        {
          id: 'openai',
          name: 'OpenAI',
          type: 'openai',
          baseURL: 'https://api.openai.com/v1',
          apiKey: '',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          fallbackProvider: 'workers-ai',
          weight: 1,
        },
      ],
      cacheEnabled: true,
      cacheTTL: 7200, // 2 hours
      rateLimiting: true,
      analytics: true,
    },
  },
  workflows: {
    enabled: true,
    maxExecutionTime: 600,
    defaultRetries: 3,
  },
};

/**
 * Minimal Configuration (development)
 */
export const minimalConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: false,
    defaultTTL: 0,
  },
  rateLimit: {
    enabled: false,
    maxRequests: 0,
    window: 0,
  },
  cors: {
    enabled: true,
    allowedOrigins: ['*'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
  },
};

// ============================================================
// Config Mergers
// ============================================================

/**
 * Deep merge configs
 */
export function mergeConfigs<T extends Record<string, any>>(
  base: T,
  ...overrides: Array<Partial<Record<string, any>>>
): Record<string, any> {
  return overrides.reduce((acc, override) => {
    return deepMerge(acc, override);
  }, base);
}

function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<Record<string, any>>
): Record<string, any> {
  const output: Record<string, unknown> = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = (target as Record<string, unknown>)[key];

      if (isObject(sourceValue)) {
        if (!(key in target)) {
          output[key] = sourceValue;
        } else if (isObject(targetValue)) {
          output[key] = deepMerge(
            targetValue as Record<string, any>,
            sourceValue
          );
        } else {
          output[key] = sourceValue;
        }
      } else {
        output[key] = sourceValue;
      }
    });
  }

  return output;
}

function isObject(item: unknown): item is Record<string, any> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}

// ============================================================
// Config Validators
// ============================================================

/**
 * Validate worker config
 */
export function validateConfig(config: WorkerConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate cache
  if (config.cache?.enabled && config.cache.defaultTTL < 0) {
    errors.push('Cache defaultTTL must be >= 0');
  }

  // Validate rate limit
  if (config.rateLimit?.enabled && config.rateLimit.maxRequests < 1) {
    errors.push('Rate limit maxRequests must be >= 1');
  }

  // Validate AI
  if (config.ai?.enabled && (!config.ai.gateway || config.ai.gateway.providers.length === 0)) {
    errors.push('AI gateway must have at least one provider when enabled');
  }

  // Validate workflows
  if (config.workflows?.enabled && config.workflows.maxExecutionTime < 1) {
    errors.push('Workflow maxExecutionTime must be >= 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// Config Builders (Fluent API)
// ============================================================

export class ConfigBuilder {
  private config: Partial<WorkerConfig> = {};

  static create(): ConfigBuilder {
    return new ConfigBuilder();
  }

  withCache(config: Partial<NonNullable<WorkerConfig['cache']>>): ConfigBuilder {
    this.config.cache = this.config.cache ? { ...this.config.cache, ...config } : config as NonNullable<WorkerConfig['cache']>;
    return this;
  }

  withRateLimit(config: Partial<NonNullable<WorkerConfig['rateLimit']>>): ConfigBuilder {
    this.config.rateLimit = this.config.rateLimit ? { ...this.config.rateLimit, ...config } : config as NonNullable<WorkerConfig['rateLimit']>;
    return this;
  }

  withAI(config: Partial<NonNullable<WorkerConfig['ai']>>): ConfigBuilder {
    this.config.ai = this.config.ai ? { ...this.config.ai, ...config } : config as NonNullable<WorkerConfig['ai']>;
    return this;
  }

  withWorkflows(config: Partial<NonNullable<WorkerConfig['workflows']>>): ConfigBuilder {
    this.config.workflows = this.config.workflows ? { ...this.config.workflows, ...config } : config as NonNullable<WorkerConfig['workflows']>;
    return this;
  }

  withCORS(config: Partial<NonNullable<WorkerConfig['cors']>>): ConfigBuilder {
    this.config.cors = this.config.cors ? { ...this.config.cors, ...config } : config as NonNullable<WorkerConfig['cors']>;
    return this;
  }

  withAnalytics(config: Partial<NonNullable<WorkerConfig['analytics']>>): ConfigBuilder {
    this.config.analytics = this.config.analytics ? { ...this.config.analytics, ...config } : config as NonNullable<WorkerConfig['analytics']>;
    return this;
  }

  withCompression(config: Partial<NonNullable<WorkerConfig['compression']>>): ConfigBuilder {
    this.config.compression = this.config.compression ? { ...this.config.compression, ...config } : config as NonNullable<WorkerConfig['compression']>;
    return this;
  }

  withImageOptimization(config: Partial<NonNullable<WorkerConfig['imageOptimization']>>): ConfigBuilder {
    this.config.imageOptimization = this.config.imageOptimization ? { ...this.config.imageOptimization, ...config } : config as NonNullable<WorkerConfig['imageOptimization']>;
    return this;
  }

  withQueues(config: Partial<NonNullable<WorkerConfig['queues']>>): ConfigBuilder {
    this.config.queues = this.config.queues ? { ...this.config.queues, ...config } : config as NonNullable<WorkerConfig['queues']>;
    return this;
  }

  withScheduledTasks(config: Partial<NonNullable<WorkerConfig['scheduledTasks']>>): ConfigBuilder {
    this.config.scheduledTasks = this.config.scheduledTasks ? { ...this.config.scheduledTasks, ...config } : config as NonNullable<WorkerConfig['scheduledTasks']>;
    return this;
  }

  build(): Partial<WorkerConfig> {
    return this.config;
  }
}

// ============================================================
// Environment-based Config Loader
// ============================================================

export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  envVars: Record<string, string>;
}

/**
 * Load config from environment variables
 */
export function loadConfigFromEnv(
  env: Record<string, string | undefined>
): Partial<WorkerConfig> {
  const config: Partial<WorkerConfig> = {};

  // Cache
  if (env.CF_CACHE_ENABLED === 'true') {
    config.cache = {
      enabled: true,
      defaultTTL: parseInt(env.CF_CACHE_DEFAULT_TTL || '300', 10),
    };
  }

  // Rate Limit
  if (env.CF_RATE_LIMIT_ENABLED === 'true') {
    config.rateLimit = {
      enabled: true,
      maxRequests: parseInt(env.CF_RATE_LIMIT_MAX || '100', 10),
      window: parseInt(env.CF_RATE_LIMIT_WINDOW || '60', 10),
    };
  }

  // AI
  if (env.CF_AI_ENABLED === 'true') {
    config.ai = {
      enabled: true,
      gateway: {
        gatewayId: env.CF_AI_GATEWAY_ID || 'default',
        providers: JSON.parse(env.CF_AI_PROVIDERS || '[]'),
        cacheEnabled: env.CF_AI_CACHE_ENABLED === 'true',
        cacheTTL: parseInt(env.CF_AI_CACHE_TTL || '3600', 10),
      },
    };
  }

  // Workflows
  if (env.CF_WORKFLOWS_ENABLED === 'true') {
    config.workflows = {
      enabled: true,
      maxExecutionTime: parseInt(env.CF_WORKFLOWS_MAX_TIME || '600', 10),
      defaultRetries: parseInt(env.CF_WORKFLOWS_RETRIES || '3', 10),
    };
  }

  // CORS
  if (env.CF_CORS_ENABLED === 'true') {
    config.cors = {
      enabled: true,
      allowedOrigins: env.CF_CORS_ORIGINS?.split(',') || ['*'],
      allowedMethods: env.CF_CORS_METHODS?.split(',') || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: env.CF_CORS_HEADERS?.split(',') || ['*'],
      maxAge: parseInt(env.CF_CORS_MAX_AGE || '86400', 10),
    };
  }

  return config;
}

/**
 * Get environment-specific config
 */
export function getEnvironmentConfig(
  environment: 'development' | 'staging' | 'production'
): Partial<WorkerConfig> {
  switch (environment) {
    case 'development':
      return mergeConfigs(minimalConfig, {
        cache: { enabled: false, defaultTTL: 0 },
        rateLimit: { enabled: false, maxRequests: 0, window: 0 },
        cors: { enabled: true, allowedOrigins: ['*'], allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['*'] },
      });

    case 'staging':
      return mergeConfigs(socialMediaConfig, {
        cache: { defaultTTL: 60 },
        rateLimit: { maxRequests: 200 },
      });

    case 'production':
      return socialMediaConfig;

    default:
      return minimalConfig;
  }
}
