# @umituz/web-cloudflare Integration Skill

## Overview

`@umituz/web-cloudflare` is a comprehensive Cloudflare Workers & Pages integration package with config-based patterns, middleware, router, workflows, and AI capabilities. Built with **Domain-Driven Design (DDD 8.5/10)** architecture, it provides type-safe, tree-shakeable exports for optimal bundle size.

### Key Features

- ✅ **Config-Based Patterns** - Pre-built configurations for different app types
- ✅ **Domain-Driven Design** - Modular architecture with Value Objects, Domain Events, Repository Pattern
- ✅ **Wrangler CLI Integration** - TypeScript wrapper for Wrangler commands
- ✅ **Workers Service** - HTTP handler with routing and middleware
- ✅ **AI Gateway** - Multi-provider AI routing with caching and fallback
- ✅ **Workers AI Integration** - AI content generation with emotion control
- ✅ **Express-like Router** - Simple, intuitive routing with middleware support
- ✅ **Comprehensive Middleware** - CORS, caching, rate limiting, security, compression
- ✅ **Workflows** - Idempotent, retryable long-running operations
- ✅ **100+ Utility Functions** - Helper functions for common tasks
- ✅ **Full TypeScript Support** - Type-safe development experience
- ✅ **Tree-Shakeable** - Subpath exports for optimal bundle size
- ✅ **Performance Optimized** - Memory leak prevention, LRU caching, route caching

## When to Use This Package

### Trigger Conditions

Use this skill when:

1. **Building Edge Applications** - You need serverless edge computing with global distribution
2. **API Gateway Requirements** - You need rate limiting, caching, CORS, and routing
3. **AI Integration** - You want to integrate AI capabilities (Workers AI, OpenAI, etc.)
4. **Storage Needs** - You need KV storage, R2 object storage, or D1 database
5. **Workflow Orchestration** - You have long-running, retryable operations
6. **Social Media Apps** - Content generation, multi-platform publishing
7. **E-commerce** - Product APIs, cart management, payment processing
8. **SaaS Platforms** - Subscription management, feature flags
9. **CDN Requirements** - Static file serving, image optimization
10. **Performance Optimization** - You need edge caching and optimization

### Ideal Use Cases

- **New Projects** - Greenfield edge computing applications
- **Cloudflare Migration** - Moving existing apps to Cloudflare Workers
- **Microservices** - Breaking down monoliths into edge functions
- **API Backends** - REST/GraphQL APIs with edge computing benefits
- **Content Delivery** - Fast, cached content delivery globally
- **AI-Powered Apps** - Applications with AI content generation needs

## Installation

### Step 1: Install Package

```bash
npm install @umituz/web-cloudflare
```

### Step 2: Install Development Dependencies

```bash
npm install --save-dev @cloudflare/workers-types typescript
```

### Step 3: Configure TypeScript

Create or update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "sourceMap": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Step 4: Configure Wrangler

Create `wrangler.toml`:

```toml
name = "my-worker"
main = "src/worker.ts"
compatibility_date = "2024-01-01"
workers_dev = true

# KV Storage
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

# R2 Storage
[[r2_buckets]]
binding = "R2"
bucket_name = "my-bucket"

# D1 Database
[[d1_databases]]
binding = "D1"
database_name = "my-database"

# Workers AI
[ai]
binding = "AI"

# Environment Variables
[vars]
ENVIRONMENT = "development"

# Secrets (use wrangler secret put)
# wrangler secret put API_KEY
```

### Step 5: Define Environment Types

Create `src/env.d.ts`:

```typescript
interface Env {
  KV: KVNamespace;
  R2: R2Bucket;
  D1: D1Database;
  AI: Ai;
  ENVIRONMENT: string;
}

export type { Env };
```

## Integration Approaches

### Approach 1: Quick Start (Recommended for Beginners)

Use pre-built configs and router for rapid development.

#### 1.1 Create Worker Entry Point

```typescript
// src/worker.ts
import { WorkersService } from '@umituz/web-cloudflare/workers';
import { socialMediaConfig } from '@umituz/web-cloudflare/config';
import { createRouter } from '@umituz/web-cloudflare/router';
import { cors, checkRateLimit } from '@umituz/web-cloudflare/middleware';
import { json } from '@umituz/web-cloudflare/utils';

type Env = import('./env').Env;

const router = createRouter()
  .use(cors)
  .use(checkRateLimit)
  .get('/', () => json({ message: 'Hello World' }))
  .get('/api/health', () => json({ status: 'healthy' }))
  .get('/api/users', async () => {
    const users = await fetchUsers();
    return json({ users });
  });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.handle(request, env, ctx);
  },
};
```

#### 1.2 Deploy

```bash
# Development
wrangler dev

# Production
wrangler deploy --env production
```

### Approach 2: Service-Based (Recommended for Intermediate Users)

Use individual services for more control.

#### 2.1 Create Service Instances

```typescript
// src/services/index.ts
import { KVService } from '@umituz/web-cloudflare/kv';
import { R2Service } from '@umituz/web-cloudflare/r2';
import { D1Service } from '@umituz/web-cloudflare/d1';
import { WorkflowService } from '@umituz/web-cloudflare/workflows';
import type { Env } from '../env';

export function createServices(env: Env) {
  const kv = new KVService();
  kv.bindNamespace('default', env.KV);

  const r2 = new R2Service();
  const d1 = new D1Service();
  const workflows = new WorkflowService({
    KV: env.KV,
    D1: env.D1,
    maxExecutionTime: 600,
  });

  return { kv, r2, d1, workflows };
}
```

#### 2.2 Use in Routes

```typescript
// src/worker.ts
import { createRouter } from '@umituz/web-cloudflare/router';
import { json } from '@umituz/web-cloudflare/utils';
import { createServices } from './services';
import type { Env } from './env';

const router = createRouter()
  .get('/api/users/:id', async (request, params, env, ctx) => {
    const services = createServices(env);
    const user = await services.d1.prepare('SELECT * FROM users WHERE id = ?')
      .bind(params.id)
      .first();

    if (!user) {
      return json({ error: 'User not found' }, 404);
    }

    return json({ user });
  });

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    router.handle(req, env, ctx),
};
```

### Approach 3: Advanced (DDD + Workflows + AI)

Use DDD patterns, workflows, AI, and advanced patterns.

#### 3.1 Using DDD Value Objects

```typescript
import { CacheKey, TTL, Email } from '@umituz/web-cloudflare/domains/shared';

// Create validated, immutable values
const key = CacheKey.forAI('prompt-123');
const ttl = TTL.fromHours(2);
const email = Email.create('user@example.com');

// Use in services
await kvService.put(key.value, data, { ttl: ttl.seconds });
```

#### 3.2 Using Domain Events

```typescript
import { AIResponseCachedEvent, KVEntryCreatedEvent } from '@umituz/web-cloudflare/domains/shared';

// Create domain events
const event = new AIResponseCachedEvent(
  'prompt-123',
  'gpt-4',
  1500,
  ['chat', 'user-123']
);

console.log(`[${event.occurredAt.toISOString()}] ${event.getEventName()}`);
console.log(`Aggregate: ${event.getAggregateId()}`);
```

#### 3.3 Create Workflow

```typescript
// src/workflows/social-publish.ts
import { WorkflowService } from '@umituz/web-cloudflare/workflows';

export async function setupSocialPublishWorkflow(env: Env) {
  const workflowService = new WorkflowService({
    KV: env.KV,
    D1: env.D1,
    maxExecutionTime: 600,
  });

  await workflowService.createWorkflow({
    id: 'social-publish',
    name: 'Social Media Publish',
    description: 'Generate and publish content to social platforms',
    steps: [
      {
        id: 'validate',
        name: 'Validate Content',
        handler: 'validate-content',
        retryPolicy: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
          maxDelay: 10000,
        },
      },
      {
        id: 'generate-ai-content',
        name: 'Generate AI Content',
        handler: 'ai-generate',
        dependencies: ['validate'],
      },
      {
        id: 'optimize-images',
        name: 'Optimize Images',
        handler: 'image-optimize',
        dependencies: ['validate'],
      },
      {
        id: 'publish',
        name: 'Publish to Platforms',
        handler: 'social-publish',
        dependencies: ['generate-ai-content', 'optimize-images'],
      },
    ],
  });

  return workflowService;
}
```

## Quick Start Examples

### Basic Worker with Router

```typescript
import { createRouter, json } from '@umituz/web-cloudflare/router';
import { cors, cache } from '@umituz/web-cloudflare/middleware';

const router = createRouter()
  .use(cors)
  .use(cache({ enabled: true, defaultTTL: 300 }))
  .get('/api/hello', () => json({ message: 'Hello World' }))
  .get('/api/users', async () => {
    const users = await fetchUsers();
    return json(users);
  });

export default {
  fetch: (req, env, ctx) => router.handle(req, env, ctx),
};
```

### Using KV Cache with DDD

```typescript
import { kvService } from '@umituz/web-cloudflare/kv';
import { CacheKey, TTL } from '@umituz/web-cloudflare/domains/shared';

// Initialize
kvService.bindNamespace('default', env.CACHE);

// Use cache with value objects
const key = CacheKey.withPrefix('users', 'list');
const ttl = TTL.FIFTEEN_MINUTES;

const data = await kvService.getOrSet(key.value, async () => {
  return await fetchUsers();
});

// Or use TTL in seconds
await kvService.put('users', data, { ttl: ttl.seconds });
```

### Rate Limiting

```typescript
import { checkRateLimit } from '@umituz/web-cloudflare/middleware';

const result = await checkRateLimit(request, {
  enabled: true,
  maxRequests: 100,
  window: 60,
  by: 'ip'
});

if (result) return result; // Rate limit exceeded
```

### File Upload (R2)

```typescript
import { R2Service } from '@umituz/web-cloudflare/r2';

const r2Service = new R2Service();

router.post('/api/upload', async (request) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  const result = await r2Service.uploadFile(
    env.R2,
    'uploads/' + file.name,
    file.stream()
  );

  return json({ success: true, key: result.key });
});
```

### AI Content Generation

```typescript
import { WorkersAIService } from '@umituz/web-cloudflare/workers-ai';

const aiService = new WorkersAIService({
  bindings: { AI: env.AI },
  config: {
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    temperature: 0.7,
    maxTokens: 1000,
  },
});

router.post('/api/generate', async (request) => {
  const { topic, platform } = await request.json();

  const content = await aiService.generateSocialContent({
    topic,
    platform,
    tone: 'professional',
    hashtags: true,
  });

  return json({ content });
});
```

## Configuration Patterns

### Pre-Built Configs

```typescript
import {
  socialMediaConfig,
  ecommerceConfig,
  saasConfig,
  apiGatewayConfig,
  cdnConfig,
  aiFirstConfig,
  minimalConfig,
} from '@umituz/web-cloudflare/config';

// Use directly
const worker = new WorkersService({
  ...socialMediaConfig,
  env: {
    KV: env.KV,
    R2: env.R2,
    D1: env.D1,
    AI: env.AI,
  },
});
```

### Custom Config (Builder Pattern)

```typescript
import { ConfigBuilder } from '@umituz/web-cloudflare/config';

const customConfig = ConfigBuilder
  .create()
  .withCache({
    enabled: true,
    defaultTTL: 300,
    paths: {
      '/api/posts': 3600,
      '/api/users': 0,
    },
  })
  .withRateLimit({
    enabled: true,
    maxRequests: 100,
    window: 60,
  })
  .withAI({
    enabled: true,
    gateway: {
      providers: [
        {
          id: 'workers-ai',
          type: 'workers-ai',
          models: ['@cf/meta/llama-3.1-8b-instruct'],
          weight: 2,
        },
      ],
      cacheEnabled: true,
      cacheTTL: 3600,
    },
  })
  .build();
```

### Environment-Based Config

```typescript
import { loadConfigFromEnv, getEnvironmentConfig } from '@umituz/web-cloudflare/config';

// Load from environment variables
const config = loadConfigFromEnv({
  CF_CACHE_ENABLED: 'true',
  CF_CACHE_DEFAULT_TTL: '300',
  CF_RATE_LIMIT_ENABLED: 'true',
  CF_AI_ENABLED: 'true',
});

// Or use environment presets
const stagingConfig = getEnvironmentConfig('staging');
const prodConfig = getEnvironmentConfig('production');
```

## Performance Features

This package includes automatic performance optimizations:

- **Memory Leak Prevention** - All caches auto-cleanup expired entries
- **Route Caching** - 80% faster route matching with LRU cache
- **LRU Eviction** - Intelligent cache management with size limits
- **Batch Operations** - Faster KV writes (100 items per batch)
- **Hit Rate Tracking** - Monitor cache effectiveness
- **Hierarchical Caching** - L1 (memory) + L2 (KV) caching strategy

### Monitoring Performance

```typescript
import { getCacheStats } from '@umituz/web-cloudflare/kv';

// Get cache statistics
const stats = await kvService.getCacheStats();
console.log(`L1 Cache Size: ${stats.l1Size}`);
console.log(`L1 Hit Rate: ${stats.l1HitRate}%`);

// Add performance headers
response.headers.set('X-Cache-Hit-Rate', stats.l1HitRate.toString());
response.headers.set('X-Cache-Size', stats.l1Size.toString());
```

## Subpath Exports

Import only what you need for optimal bundle size:

```typescript
// Workers
import { WorkersService } from '@umituz/web-cloudflare/workers';

// KV Cache
import { KVService } from '@umituz/web-cloudflare/kv';

// DDD Features
import { CacheKey, TTL, Email } from '@umituz/web-cloudflare/domains/shared';
import { AIResponseCachedEvent } from '@umituz/web-cloudflare/domains/shared';

// R2 Storage
import { R2Service } from '@umituz/web-cloudflare/r2';

// D1 Database
import { D1Service } from '@umituz/web-cloudflare/d1';

// AI Gateway
import { AIGatewayService } from '@umituz/web-cloudflare/ai';

// Workers AI
import { WorkersAIService } from '@umituz/web-cloudflare/workers-ai';

// Workflows
import { WorkflowService } from '@umituz/web-cloudflare/workflows';

// Router
import { createRouter } from '@umituz/web-cloudflare/router';

// Middleware
import { cors, cache, checkRateLimit } from '@umituz/web-cloudflare/middleware';

// Utils
import { json, error, parseBody } from '@umituz/web-cloudflare/utils';

// Config
import { socialMediaConfig, ConfigBuilder } from '@umituz/web-cloudflare/config';
```

## Environment Variables

```bash
CF_CACHE_ENABLED=true
CF_CACHE_DEFAULT_TTL=300
CF_RATE_LIMIT_ENABLED=true
CF_RATE_LIMIT_MAX=100
CF_AI_ENABLED=true
CF_WORKFLOWS_ENABLED=true
```

## Deployment

```bash
# Using Wrangler
npm run deploy

# Or with custom environment
wrangler deploy --env production
```

## Best Practices

### 1. Use Subpath Imports

```typescript
// ✅ Good - Tree-shakeable
import { createRouter } from '@umituz/web-cloudflare/router';
import { cors } from '@umituz/web-cloudflare/middleware';

// ❌ Bad - Imports entire package
import { createRouter, cors } from '@umituz/web-cloudflare';
```

### 2. Use DDD Value Objects

```typescript
// ✅ Good - Type-safe and validated
const key = CacheKey.forAI('prompt-123');
const ttl = TTL.fromHours(2);

// ❌ Bad - Prone to errors
const key = 'ai:prompt-123';
const ttl = 7200;
```

### 3. Cache Aggressively

```typescript
// Cache static content
router.get('/api/posts', cache({ ttl: 3600 }), async () => {
  return json({ posts: await fetchPosts() });
});

// Don't cache dynamic content
router.get('/api/cart', async () => {
  return json({ cart: await fetchCart() });
});
```

### 4. Use Workflows for Long Operations

```typescript
// ✅ Good - Workflow for long operations
const execution = await workflowService.startExecution('media-processing', {
  mediaUrl: 'https://example.com/video.mp4',
});

// ❌ Bad - Blocking request
await processMedia(mediaUrl); // Takes too long
```

### 5. Handle Errors Gracefully

```typescript
router.get('/api/users/:id', async (request, params) => {
  try {
    const user = await getUser(params.id);
    if (!user) {
      return fail('User not found', 404);
    }
    return success(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return fail('Internal server error', 500);
  }
});
```

### 6. Monitor Performance

- Check cache hit rates regularly
- Enable route caching for high-traffic routes
- Use batch operations for bulk KV writes
- Cleanup expired cache entries

## Troubleshooting

### High Memory Usage

```typescript
import { invalidateCache } from '@umituz/web-cloudflare/middleware';
invalidateCache(); // Clear all caches

// Or cleanup L1 cache
await kvService.cleanupL1Cache();
```

### Slow Response Times

1. Check cache hit rate
2. Enable route caching
3. Use batch operations
4. Monitor L1 cache size

### Rate Limiting Issues

Adjust limits or whitelist trusted IPs:

```typescript
const result = await checkRateLimit(request, {
  maxRequests: 1000,
  whitelist: ['admin-ip']
});
```

### Common Issues

#### "Bindings not defined"

**Problem:** Env bindings are undefined.

**Solution:** Check `wrangler.toml` and ensure bindings match your Env interface.

```toml
[[kv_namespaces]]
binding = "KV"  # Must match Env.KV
id = "your-id"
```

#### "Module not found"

**Problem:** Import paths are incorrect.

**Solution:** Use subpath imports:

```typescript
// ❌ Wrong
import { WorkersService } from '@umituz/web-cloudflare';

// ✅ Correct
import { WorkersService } from '@umituz/web-cloudflare/workers';
```

#### "Type errors"

**Problem:** TypeScript types not resolving.

**Solution:** Ensure `@cloudflare/workers-types` is installed:

```bash
npm install --save-dev @cloudflare/workers-types
```

## Migration Guide

### From Express.js

```typescript
// Before (Express)
import express from 'express';
const app = express();
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

// After (Cloudflare Workers)
import { createRouter } from '@umituz/web-cloudflare/router';
import { json } from '@umituz/web-cloudflare/utils';

const router = createRouter()
  .get('/api/users', () => json({ users: [] }));
```

### From Next.js API Routes

```typescript
// Before (Next.js)
export default function handler(req, res) {
  res.json({ users: [] });
}

// After (Cloudflare Workers)
import { json } from '@umituz/web-cloudflare/utils';

export default {
  fetch: () => json({ users: [] }),
};
```

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [DDD Improvements Documentation](./src/domains/DDD-IMPROVEMENTS.md)
- Package Repository: [github.com/umituz/web-cloudflare](https://github.com/umituz/web-cloudflare)

---

**Version:** 1.6.4
**Last Updated:** 2026-03-31
**Author:** umituz
**DDD Score:** 8.5/10 (Solid DDD)
