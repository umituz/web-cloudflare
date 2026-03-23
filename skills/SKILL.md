# @umituz/web-cloudflare Integration Skill

## Overview

`@umituz/web-cloudflare` is a comprehensive Cloudflare Workers & Pages integration package with config-based patterns, middleware, router, workflows, and AI capabilities. Built with Domain-Driven Design (DDD) architecture, it provides type-safe, tree-shakeable exports for optimal bundle size.

### Key Features

- ✅ **Config-Based Patterns** - Pre-built configurations for different app types
- ✅ **Domain-Driven Design** - Modular architecture with isolated domains
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
    "strict": true
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
import { WorkersService } from '@umituz/web-cloudflare/workers';
import { KVService } from '@umituz/web-cloudflare/kv';
import { R2Service } from '@umituz/web-cloudflare/r2';
import { D1Service } from '@umituz/web-cloudflare/d1';
import { WorkflowService } from '@umituz/web-cloudflare/workflows';
import type { Env } from '../env';

export function createServices(env: Env) {
  const kv = new KVService({ bindings: { KV: env.KV } });
  const r2 = new R2Service({ bindings: { R2: env.R2 } });
  const d1 = new D1Service({ bindings: { D1: env.D1 } });
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

### Approach 3: Advanced (Full-Stack with Workflows)

Use workflows, AI, and advanced patterns.

#### 3.1 Create Workflow

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

#### 3.2 Create AI Service

```typescript
// src/services/ai.ts
import { WorkersAIService } from '@umituz/web-cloudflare/workers-ai';
import type { Env } from '../env';

export function createAIService(env: Env) {
  return new WorkersAIService({
    bindings: { AI: env.AI },
    config: {
      defaultModel: '@cf/meta/llama-3.1-8b-instruct',
      temperature: 0.7,
      maxTokens: 1000,
    },
  });
}

export async function generateSocialPost(
  aiService: WorkersAIService,
  topic: string,
  platform: 'twitter' | 'linkedin'
) {
  return await aiService.generateSocialContent({
    topic,
    platform,
    tone: platform === 'linkedin' ? 'professional' : 'casual',
    hashtags: true,
    maxLength: platform === 'twitter' ? 280 : 3000,
  });
}
```

#### 3.3 Integrate Everything

```typescript
// src/worker.ts
import { createRouter } from '@umituz/web-cloudflare/router';
import { cors } from '@umituz/web-cloudflare/middleware';
import { json, success, fail } from '@umituz/web-cloudflare/utils';
import { createServices } from './services';
import { createAIService, generateSocialPost } from './services/ai';
import { setupSocialPublishWorkflow } from './workflows/social-publish';
import type { Env } from './env';

const router = createRouter()
  .use(cors)
  .post('/api/publish', async (request, env) => {
    const { topic, platforms } = await request.json();

    // Start workflow
    const workflowService = await setupSocialPublishWorkflow(env);
    const execution = await workflowService.startExecution('social-publish', {
      topic,
      platforms,
    });

    return success({
      executionId: execution.id,
      status: execution.status,
      message: 'Publish workflow started',
    });
  })
  .get('/api/generate/:topic', async (request, params, env) => {
    const aiService = createAIService(env);
    const content = await generateSocialPost(
      aiService,
      params.topic,
      'twitter'
    );

    return success({ content });
  });

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    router.handle(req, env, ctx),
};
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

## Common Use Cases

### 1. REST API with Caching

```typescript
import { createRouter } from '@umituz/web-cloudflare/router';
import { cache } from '@umituz/web-cloudflare/middleware';
import { json } from '@umituz/web-cloudflare/utils';

const router = createRouter()
  .get('/api/posts', cache({ ttl: 3600 }), async () => {
    const posts = await fetchPosts();
    return json({ posts });
  });
```

### 2. File Upload (R2)

```typescript
import { R2Service } from '@umituz/web-cloudflare/r2';

const r2Service = new R2Service({ bindings: { R2: env.R2 } });

router.post('/api/upload', async (request) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  const result = await r2Service.uploadFile('uploads/' + file.name, file.stream());

  return json({ success: true, key: result.key });
});
```

### 3. Session Management (KV)

```typescript
import { KVService } from '@umituz/web-cloudflare/kv';

const kvService = new KVService({ bindings: { KV: env.KV } });

router.post('/api/login', async (request) => {
  const { email, password } = await request.json();

  // Authenticate
  const user = await authenticateUser(email, password);
  if (!user) {
    return json({ error: 'Invalid credentials' }, 401);
  }

  // Create session
  const sessionId = crypto.randomUUID();
  await kvService.set(`session:${sessionId}`, JSON.stringify(user), {
    expirationTtl: 3600,
  });

  return json({ sessionId, user });
});
```

### 4. Database Queries (D1)

```typescript
import { D1Service } from '@umituz/web-cloudflare/d1';

const d1Service = new D1Service({ bindings: { D1: env.D1 } });

router.get('/api/users/:id', async (request, params) => {
  const user = await d1Service.query(
    'SELECT * FROM users WHERE id = ?',
    [params.id]
  );

  if (!user.results[0]) {
    return json({ error: 'User not found' }, 404);
  }

  return json({ user: user.results[0] });
});
```

### 5. AI Content Generation

```typescript
import { WorkersAIService } from '@umituz/web-cloudflare/workers-ai';

const aiService = new WorkersAIService({ bindings: { AI: env.AI } });

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

## Testing Strategy

### Unit Tests

```typescript
// src/__tests__/router.test.ts
import { createRouter } from '@umituz/web-cloudflare/router';
import { json } from '@umituz/web-cloudflare/utils';

describe('Router', () => {
  it('should handle GET requests', async () => {
    const router = createRouter()
      .get('/test', () => json({ message: 'Hello' }));

    const request = new Request('http://localhost/test');
    const response = await router.handle(request, {}, {} as ExecutionContext);

    const data = await response.json();
    expect(data).toEqual({ message: 'Hello' });
  });
});
```

### Integration Tests

```typescript
// src/__tests__/worker.test.ts
import worker from '../worker';
import { createEnv } from './utils';

describe('Worker', () => {
  it('should handle API requests', async () => {
    const env = createEnv();
    const request = new Request('http://localhost/api/users/123');

    const response = await worker.fetch(request, env, {} as ExecutionContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
  });
});
```

### E2E Tests

```bash
# Start local development
wrangler dev --port 8787

# Run tests
npm run test:e2e
```

## Troubleshooting

### Common Issues

#### 1. "Bindings not defined"

**Problem:** Env bindings are undefined.

**Solution:** Check `wrangler.toml` and ensure bindings match your Env interface.

```toml
[[kv_namespaces]]
binding = "KV"  # Must match Env.KV
id = "your-id"
```

#### 2. "Module not found"

**Problem:** Import paths are incorrect.

**Solution:** Use subpath imports:

```typescript
// ❌ Wrong
import { WorkersService } from '@umituz/web-cloudflare';

// ✅ Correct
import { WorkersService } from '@umituz/web-cloudflare/workers';
```

#### 3. "Type errors"

**Problem:** TypeScript types not resolving.

**Solution:** Ensure `@cloudflare/workers-types` is installed:

```bash
npm install --save-dev @cloudflare/workers-types
```

#### 4. "CORS errors"

**Problem:** CORS headers not set.

**Solution:** Add CORS middleware:

```typescript
import { cors } from '@umituz/web-cloudflare/middleware';

router.use(cors);
```

#### 5. "Rate limiting issues"

**Problem:** Requests being rate limited.

**Solution:** Adjust rate limit config:

```typescript
ConfigBuilder
  .create()
  .withRateLimit({
    enabled: true,
    maxRequests: 200,  // Increase
    window: 60,
  })
  .build();
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

### 2. Cache Aggressively

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

### 3. Use Workflows for Long Operations

```typescript
// ✅ Good - Workflow for long operations
const execution = await workflowService.startExecution('media-processing', {
  mediaUrl: 'https://example.com/video.mp4',
});

// ❌ Bad - Blocking request
await processMedia(mediaUrl); // Takes too long
```

### 4. Handle Errors Gracefully

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

### 5. Use Environment Configs

```typescript
// Different configs for different environments
const config = getEnvironmentConfig(env.ENVIRONMENT);

const worker = new WorkersService({
  ...config,
  env: {
    KV: env.KV,
    R2: env.R2,
    D1: env.D1,
    AI: env.AI,
  },
});
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
- Package Repository: [github.com/umituz/web-cloudflare](https://github.com/umituz/web-cloudflare)

---

**Version:** 1.4.12
**Last Updated:** 2025-03-23
**Author:** umituz
