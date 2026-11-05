
import type { WorkerConfig } from './types';
import { deepMerge } from '../infrastructure/utils/helpers';


export const socialMediaConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 300,
    paths: {
      '/api/posts': 3600,
      '/api/feed': 1800,
      '/api/trending': 600,
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

export const ecommerceConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 60,
    paths: {
      '/api/products': 300,
      '/api/categories': 3600,
      '/api/cart': 0,
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

export const cdnConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 86400,
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
      cacheTTL: 7200,
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

export const aiReadyConfig: Partial<WorkerConfig> = {
  cache: {
    enabled: true,
    defaultTTL: 3600,
    paths: {
      '/api/ai/*': 7200,
      '/api/embeddings/*': 86400,
      '/api/vectors/*': 86400,
      '/api/huggingface/*': 7200,
    },
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    window: 60,
    by: 'user',
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
          models: [
            '@cf/meta/llama-3.1-8b-instruct',
            '@cf/meta/llama-3.3-70b-instruct',
            '@cf/mistral/mistral-7b-instruct',
          ],
          weight: 3,
          pricing: {
            '@cf/meta/llama-3.1-8b-instruct': {
              inputCostPer1KTokens: 0.00015,
              outputCostPer1KTokens: 0.00015,
              neuronsPer1KTokens: 208,
            },
            '@cf/meta/llama-3.3-70b-instruct': {
              inputCostPer1KTokens: 0.00045,
              outputCostPer1KTokens: 0.00045,
              neuronsPer1KTokens: 1110,
            },
          },
        },
        {
          id: 'huggingface',
          name: 'Hugging Face',
          type: 'custom',
          baseURL: 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/huggingface',
          apiKey: '',
          models: [
            'meta-llama/Llama-3.1-8B',
            'meta-llama/Llama-3.3-70B',
            'facebook/musicgen-small',
            'openai/whisper-large-v3',
          ],
          weight: 2,
          pricing: {
            'meta-llama/Llama-3.1-8B': {
              inputCostPer1KTokens: 0.00007,
              outputCostPer1KTokens: 0.00007,
            },
            'meta-llama/Llama-3.3-70B': {
              inputCostPer1KTokens: 0.0007,
              outputCostPer1KTokens: 0.0007,
            },
          },
        },
        {
          id: 'openai-fallback',
          name: 'OpenAI',
          type: 'openai',
          baseURL: 'https://api.openai.com/v1',
          apiKey: '',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          fallbackProvider: 'workers-ai',
          weight: 1,
          pricing: {
            'gpt-4': {
              inputCostPer1KTokens: 0.03,
              outputCostPer1KTokens: 0.06,
            },
            'gpt-3.5-turbo': {
              inputCostPer1KTokens: 0.0005,
              outputCostPer1KTokens: 0.0015,
            },
          },
        },
      ],
      cacheEnabled: true,
      cacheTTL: 7200,
      rateLimiting: true,
      analytics: true,
      budget: {
        monthlyLimit: 100,
        alertThreshold: 80,
      },
    },
    huggingface: {
      enabled: true,
      accountId: '{account_id}',
      defaultGatewayId: '{gateway_id}',
      models: [
        'meta-llama/Llama-3.1-8B',
        'meta-llama/Llama-3.3-70B',
        'facebook/musicgen-small',
        'openai/whisper-large-v3',
      ],
    },
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 2048,
    },
    neuronQuota: {
      enabled: true,
      quota: 10000000,
      period: 86400,
    },
  },
  vectorize: {
    enabled: true,
    indexes: ['documents', 'embeddings'],
    defaultDimensions: 512,
    metric: 'cosine',
  },
  workflows: {
    enabled: true,
    maxExecutionTime: 600,
    defaultRetries: 3,
  },
  analytics: {
    enabled: true,
    trackAIUsage: true,
    trackCosts: true,
  },
};

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


export function mergeConfigs<T extends Record<string, unknown>>(
  base: T,
  ...overrides: Array<Partial<Record<string, unknown>>>
): Record<string, unknown> {
  return overrides.reduce((acc, override) => {
    return deepMerge(acc, override);
  }, base);
}


export function validateConfig(config: WorkerConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.cache?.enabled && config.cache.defaultTTL < 0) {
    errors.push('Cache defaultTTL must be >= 0');
  }

  if (config.rateLimit?.enabled && config.rateLimit.maxRequests < 1) {
    errors.push('Rate limit maxRequests must be >= 1');
  }

  if (config.ai?.enabled && (!config.ai.gateway || config.ai.gateway.providers.length === 0)) {
    errors.push('AI gateway must have at least one provider when enabled');
  }

  if (config.workflows?.enabled && config.workflows.maxExecutionTime < 1) {
    errors.push('Workflow maxExecutionTime must be >= 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


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


  withAIGateway(config: Partial<NonNullable<WorkerConfig['ai']>['gateway']>): ConfigBuilder {
    if (!this.config.ai) {
      this.config.ai = { enabled: true };
    }
    this.config.ai.gateway = this.config.ai.gateway ? { ...this.config.ai.gateway, ...config } : config as NonNullable<WorkerConfig['ai']>['gateway'];
    return this;
  }

  withAIModels(models: string[]): ConfigBuilder {
    if (!this.config.ai) {
      this.config.ai = { enabled: true };
    }
    if (!this.config.ai.gateway) {
      this.config.ai.gateway = { providers: [] };
    }
    if (this.config.ai.gateway.providers.length === 0) {
      this.config.ai.gateway.providers.push({
        id: 'default',
        name: 'Default',
        type: 'workers-ai',
        baseURL: '',
        apiKey: '',
        models,
        weight: 1,
      });
    } else {
      this.config.ai.gateway.providers[0].models = models;
    }
    return this;
  }

  withAICaching(enabled: boolean, ttl?: number): ConfigBuilder {
    if (!this.config.ai) {
      this.config.ai = { enabled: true };
    }
    if (!this.config.ai.gateway) {
      this.config.ai.gateway = { providers: [] };
    }
    this.config.ai.gateway.cacheEnabled = enabled;
    if (ttl !== undefined) {
      this.config.ai.gateway.cacheTTL = ttl;
    }
    return this;
  }

  withAIQuota(quota: number, period: number): ConfigBuilder {
    if (!this.config.ai) {
      this.config.ai = { enabled: true };
    }
    this.config.ai.neuronQuota = {
      enabled: true,
      quota,
      period,
    };
    return this;
  }

  withVectorize(enabled: boolean, indexes?: string[]): ConfigBuilder {
    this.config.vectorize = {
      enabled,
      indexes: indexes || [],
      defaultDimensions: 512,
      metric: 'cosine',
    };
    return this;
  }

  withCostTracking(monthlyLimit: number, alertThreshold?: number): ConfigBuilder {
    if (!this.config.ai) {
      this.config.ai = { enabled: true };
    }
    if (!this.config.ai.gateway) {
      this.config.ai.gateway = { providers: [] };
    }
    this.config.ai.gateway.budget = {
      monthlyLimit,
      alertThreshold: alertThreshold || Math.floor(monthlyLimit * 0.8),
    };
    return this;
  }

  withHuggingFace(config: {
    enabled: boolean;
    accountId?: string;
    defaultGatewayId?: string;
    models?: string[];
  }): ConfigBuilder {
    if (!this.config.ai) {
      this.config.ai = { enabled: true };
    }
    this.config.ai.huggingface = config;

    if (config.enabled && config.accountId && config.defaultGatewayId) {
      if (!this.config.ai.gateway) {
        this.config.ai.gateway = { providers: [] };
      }

      const hfURL = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.defaultGatewayId}/huggingface`;

      const existingHFProvider = this.config.ai.gateway.providers.find(
        p => p.baseURL.includes('/huggingface')
      );

      if (!existingHFProvider) {
        this.config.ai.gateway.providers.push({
          id: 'huggingface',
          name: 'Hugging Face',
          type: 'custom',
          baseURL: hfURL,
          apiKey: '',
          models: config.models || [],
          weight: 2,
        });
      }
    }

    return this;
  }

  withMultiTenant(config: {
    enabled: boolean;
    d1Bindings?: string[];
    r2Bindings?: string[];
    kvNamespaces?: string[];
  }): ConfigBuilder {
    this.config.multiTenant = config;
    return this;
  }

  build(): Partial<WorkerConfig> {
    return this.config;
  }
}


export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  envVars: Record<string, string>;
}

export function loadConfigFromEnv(
  env: Record<string, string | undefined>
): Partial<WorkerConfig> {
  const config: Partial<WorkerConfig> = {};

  if (env.CF_CACHE_ENABLED === 'true') {
    config.cache = {
      enabled: true,
      defaultTTL: parseInt(env.CF_CACHE_DEFAULT_TTL || '300', 10),
    };
  }

  if (env.CF_RATE_LIMIT_ENABLED === 'true') {
    config.rateLimit = {
      enabled: true,
      maxRequests: parseInt(env.CF_RATE_LIMIT_MAX || '100', 10),
      window: parseInt(env.CF_RATE_LIMIT_WINDOW || '60', 10),
    };
  }

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

  if (env.CF_WORKFLOWS_ENABLED === 'true') {
    config.workflows = {
      enabled: true,
      maxExecutionTime: parseInt(env.CF_WORKFLOWS_MAX_TIME || '600', 10),
      defaultRetries: parseInt(env.CF_WORKFLOWS_RETRIES || '3', 10),
    };
  }

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
