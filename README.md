# @umituz/web-cloudflare

Comprehensive Cloudflare Workers integration with config-based patterns, middleware, router, workflows, and AI.

## 🚀 Features

- ✅ **Config-Based Patterns** - Pre-built configurations for different app types
- ✅ **Domain-Driven Design** - DDD architecture for better modularity
- ✅ **Wrangler CLI Integration** - TypeScript wrapper for Wrangler CLI commands
- ✅ **Workers Service** - HTTP handler with routing and middleware
- ✅ **AI Gateway** - Multi-provider AI routing with caching and fallback
- ✅ **Workers AI Integration** - AI content generation with emotion control
- ✅ **Express-like Router** - Simple, intuitive routing with middleware support
- ✅ **Comprehensive Middleware** - CORS, caching, rate limiting, security, compression
- ✅ **Workflows** - Idempotent, retryable long-running operations
- ✅ **Utility Functions** - 100+ helper functions for common tasks
- ✅ **Type-Safe** - Full TypeScript support
- ✅ **Tree-Shakeable** - Subpath exports for optimal bundle size

## 📦 Installation

```bash
npm install @umituz/web-cloudflare
```

## 🎯 Quick Start

### Using Pre-built Configs

```typescript
import { socialMediaConfig, ConfigBuilder, WorkerService } from '@umituz/web-cloudflare/config';
import { createRouter } from '@umituz/web-cloudflare/router';
import { cors, addCorsHeaders } from '@umituz/web-cloudflare/middleware';

// Use pre-built config
const worker = new WorkerService({
  ...socialMediaConfig,
  env: {
    KV: env.KV,
    R2: env.R2,
    D1: env.D1,
    AI: env.AI,
  },
});

// Or build your own
const customConfig = ConfigBuilder
  .create()
  .withCache({ enabled: true, defaultTTL: 300 })
  .withRateLimit({ enabled: true, maxRequests: 100, window: 60 })
  .withAI({ enabled: true })
  .build();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return worker.handle(request);
  },
};
```

### Using Router

```typescript
import { createRouter, json, success, fail } from '@umituz/web-cloudflare/router';
import { cors } from '@umituz/web-cloudflare/middleware';

const router = createRouter()
  .use(cors) // Add CORS middleware
  .get('/api/health', () => json({ status: 'healthy' }))
  .get('/api/users', async () => {
    const users = await fetchUsers();
    return success(users);
  })
  .post('/api/users', async (request) => {
    const body = await request.json();
    const user = await createUser(body);
    return success(user, 'User created');
  })
  .get('/api/users/:id', async (request, params) => {
    const user = await getUser(params.id);
    if (!user) {
      return fail('User not found', 404);
    }
    return success(user);
  });

export default {
  fetch: (req, env, ctx) => router.handle(req, env, ctx),
};
```

### Using Workflows

```typescript
import { WorkflowService, WORKFLOW_TEMPLATES } from '@umituz/web-cloudflare/workflows';

const workflowService = new WorkflowService({
  KV: env.KV,
  D1: env.D1,
  maxExecutionTime: 600,
});

// Start workflow
const execution = await workflowService.startExecution('media-processing', {
  mediaUrl: 'https://example.com/video.mp4',
  operations: ['transcode', 'optimize', 'thumbnail'],
});

// Check status
const status = await workflowService.getExecution(execution.id);

// Resume from any step (idempotent)
await workflowService.resumeExecution(execution.id, 'transcode');
```

### Using Workers AI

```typescript
import { WorkersAIService } from '@umituz/web-cloudflare/workers-ai';

const aiService = new WorkersAIService({ bindings: { AI: env.AI } });

// Generate content with emotion control
const content = await aiService.generateSocialContent({
  topic: 'AI in social media',
  platform: 'linkedin',
  tone: 'professional',
  hashtags: true,
});

// Sentiment analysis
const analysis = await aiService.analyzeSentiment(content);
// { sentiment: 'positive', confidence: 0.89, emotions: ['excited'] }
```

### Using Wrangler CLI

```typescript
import { WranglerService } from '@umituz/web-cloudflare/wrangler';

const wrangler = new WranglerService();

// Authentication
await wrangler.login();
const authInfo = await wrangler.whoami();

// Project management
await wrangler.init('my-worker', 'typescript');
await wrangler.deploy({ env: 'production' });

// Start development server
await wrangler.dev({ port: 8787, local: true });

// KV operations
const namespace = await wrangler.kvNamespaceCreate('MY_KV');
await wrangler.kvKeyPut(namespace.id, 'key', 'value');
const value = await wrangler.kvKeyGet(namespace.id, 'key');

// R2 operations
await wrangler.r2BucketCreate('my-bucket');
const buckets = await wrangler.r2BucketList();
await wrangler.r2ObjectPut('my-bucket', 'file.txt', './local-file.txt');

// D1 operations
const db = await wrangler.d1Create('my-database');
const result = await wrangler.d1Execute('my-database', 'SELECT * FROM users');

// Secrets management
await wrangler.secretPut('API_KEY', 'secret-value');
const secrets = await wrangler.secretList();

// Monitoring
await wrangler.tail({ format: 'json' });

// Version management
const versions = await wrangler.versionsList();
await wrangler.versionsRollback(versions[0].id);
```

**Note:** All services now follow Domain-Driven Design (DDD) architecture with their own domain structures:
- Wrangler CLI: `src/domains/wrangler/`
- Workers: `src/domains/workers/`
- AI Gateway: `src/domains/ai-gateway/`
- R2: `src/domains/r2/`
- D1: `src/domains/d1/`
- KV: `src/domains/kv/`
- Images: `src/domains/images/`
- Analytics: `src/domains/analytics/`
- Workflows: `src/domains/workflows/`

## 📚 Subpath Exports

### Services

```typescript
// Workers service (now in domains/)
import { WorkersService, workersService } from '@umituz/web-cloudflare/workers';

// KV cache (now in domains/)
import { KVService, kvService } from '@umituz/web-cloudflare/kv';

// R2 storage (now in domains/)
import { R2Service, r2Service } from '@umituz/web-cloudflare/r2';

// D1 database (now in domains/)
import { D1Service, d1Service } from '@umituz/web-cloudflare/d1';

// Images optimization (now in domains/)
import { ImagesService, imagesService } from '@umituz/web-cloudflare/images';

// Analytics (now in domains/)
import { AnalyticsService, analyticsService } from '@umituz/web-cloudflare/analytics';

// Workflows (now in domains/)
import { WorkflowService } from '@umituz/web-cloudflare/workflows';

// Wrangler CLI
import { WranglerService } from '@umituz/web-cloudflare/wrangler';
```

### Workflows & AI

```typescript
// Workflows orchestration
import { WorkflowService, WORKFLOW_TEMPLATES } from '@umituz/web-cloudflare/workflows';

// AI Gateway (now in domains/)
import { AIGatewayService } from '@umituz/web-cloudflare/ai-gateway';

// Workers AI (now in domains/)
import { WorkersAIService } from '@umituz/web-cloudflare/workers-ai';
```

### Router & Middleware

```typescript
// Router
import {
  createRouter,
  resource,
  api,
  success,
  fail,
  validationError
} from '@umituz/web-cloudflare/router';

// Middleware
import {
  cors,
  cache,
  checkRateLimit,
  addSecurityHeaders,
  detectBot,
  logRequest,
  trackResponseTime
} from '@umituz/web-cloudflare/middleware';
```

### Config & Types

```typescript
// Config patterns
import {
  socialMediaConfig,
  ecommerceConfig,
  saasConfig,
  apiGatewayConfig,
  cdnConfig,
  aiFirstConfig,
  minimalConfig,
  ConfigBuilder,
  mergeConfigs,
  validateConfig,
  loadConfigFromEnv
} from '@umituz/web-cloudflare/config';

// TypeScript types
import type {
  WorkerConfig,
  CacheConfig,
  RateLimitConfig,
  AIConfig,
  WorkflowConfig
} from '@umituz/web-cloudflare/types';
```

### Utils

```typescript
// Helper functions
import {
  // Request helpers
  parseBody,
  getClientIP,
  getUserAgent,
  // Response helpers
  json,
  error,
  redirect,
  file,
  stream,
  // Validation
  isValidEmail,
  isValidURL,
  isValidUUID,
  // Cache helpers
  generateCacheKey,
  hash,
  // Time helpers
  parseDuration,
  formatDuration,
  sleep,
  retry,
  // URL helpers
  buildURL,
  parseQueryParams,
  joinPath,
  // Encoding
  base64Encode,
  base64Decode,
  // Random
  randomString,
  randomID,
  // Type guards
  isDefined,
  isEmpty,
  // And 100+ more...
} from '@umituz/web-cloudflare/utils';
```

## 🔧 Config Patterns

### Pre-built Configs

```typescript
// Social media app
import { socialMediaConfig } from '@umituz/web-cloudflare/config';

// E-commerce app
import { ecommerceConfig } from '@umituz/web-cloudflare/config';

// SaaS app
import { saasConfig } from '@umituz/web-cloudflare/config';

// API gateway
import { apiGatewayConfig } from '@umituz/web-cloudflare/config';

// CDN
import { cdnConfig } from '@umituz/web-cloudflare/config';

// AI-first app
import { aiFirstConfig } from '@umituz/web-cloudflare/config';

// Minimal (development)
import { minimalConfig } from '@umituz/web-cloudflare/config';
```

### Custom Config (Builder Pattern)

```typescript
import { ConfigBuilder } from '@umituz/web-cloudflare/config';

const config = ConfigBuilder
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
  .withWorkflows({
    enabled: true,
    maxExecutionTime: 600,
    defaultRetries: 3,
  })
  .withCORS({
    enabled: true,
    allowedOrigins: ['https://example.com'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
  .build();
```

### Environment-based Config

```typescript
import { loadConfigFromEnv, getEnvironmentConfig } from '@umituz/web-cloudflare/config';

// Load from environment variables
const config = loadConfigFromEnv({
  CF_CACHE_ENABLED: 'true',
  CF_CACHE_DEFAULT_TTL: '300',
  CF_RATE_LIMIT_ENABLED: 'true',
  CF_RATE_LIMIT_MAX: '100',
  CF_AI_ENABLED: 'true',
  CF_WORKFLOWS_ENABLED: 'true',
});

// Or use environment presets
const stagingConfig = getEnvironmentConfig('staging');
const prodConfig = getEnvironmentConfig('production');
```

## 🛣️ Router Examples

### Basic Routing

```typescript
import { createRouter } from '@umituz/web-cloudflare/router';

const router = createRouter()
  .get('/', () => json({ message: 'Hello World' }))
  .get('/users', () => json({ users: [] }))
  .post('/users', async (req) => {
    const body = await req.json();
    return json({ created: true, id: '123' });
  })
  .delete('/users/:id', (req, params) => {
    return json({ deleted: params.id });
  });
```

### Resource Routes (CRUD)

```typescript
import { resource } from '@umituz/web-cloudflare/router';

const router = createRouter();

resource(router, '/api/users', {
  index: async () => json({ users: [] }),
  show: async (req, params) => json({ user: params.id }),
  create: async (req) => {
    const body = await req.json();
    return json({ created: true, ...body }, 201);
  },
  update: async (req, params) => {
    const body = await req.json();
    return json({ updated: params.id, ...body });
  },
  delete: async (req, params) => json({ deleted: params.id }),
});
```

### Middleware Chain

```typescript
import { createRouter } from '@umituz/web-cloudflare/router';
import { cors, checkRateLimit, requireAuth } from '@umituz/web-cloudflare/middleware';

const router = createRouter()
  .use(cors)
  .use(checkRateLimit)
  .get('/public', () => json({ message: 'Public' }))
  .get('/protected', requireAuth, () => json({ message: 'Protected' }));
```

### Route Groups

```typescript
const router = createRouter();

router.group('/api/v1', (api) => {
  api.get('/users', () => json({ users: [] }));
  api.post('/users', async (req) => {
    const body = await req.json();
    return json({ created: true });
  });
});

// Creates: /api/v1/users
```

## 🎭 Middleware Examples

```typescript
import {
  cors,
  cache,
  checkRateLimit,
  addSecurityHeaders,
  detectBot,
  logRequest,
  trackResponseTime
} from '@umituz/web-cloudflare/middleware';

// Apply globally
const router = createRouter()
  .use(cors)
  .use(checkRateLimit)
  .use(addSecurityHeaders)
  .use(detectBot)
  .use(logRequest)
  .get('/', () => json({ hello: 'world' }));

// Or conditionally
router.use(
  conditionalMiddleware(
    (req) => req.method === 'POST',
    cache
  )
);
```

## 🤖 Workers AI Examples

```typescript
import { WorkersAIService } from '@umituz/web-cloudflare/workers-ai';

const ai = new WorkersAIService({ bindings: { AI: env.AI } });

// Generate social media content
const content = await ai.generateSocialContent({
  topic: 'Product launch',
  platform: 'twitter',
  tone: 'enthusiastic',
});

// Generate hashtags
const tags = await ai.generateHashtags(content, 10);

// Analyze sentiment
const sentiment = await ai.analyzeSentiment(content);

// Generate content calendar
const calendar = await ai.generateContentCalendar('tech startup', 7);

// Optimize for SEO
const optimized = await ai.optimizeSEO(content, ['AI', 'ML']);
```

## 🔄 Workflow Examples

```typescript
import { WorkflowService } from '@umituz/web-cloudflare/workflows';

const workflows = new WorkflowService({
  KV: env.KV,
  D1: env.D1,
});

// Custom workflow
await workflows.createWorkflow({
  id: 'social-publish',
  name: 'Social Media Publish',
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
      id: 'generate-content',
      name: 'Generate AI Content',
      handler: 'ai-generate',
      dependencies: ['validate'],
    },
    {
      id: 'publish',
      name: 'Publish to Platforms',
      handler: 'social-publish',
      dependencies: ['generate-content'],
    },
  ],
});

// Execute workflow
const execution = await workflows.startExecution('social-publish', {
  topic: 'New feature',
  platforms: ['twitter', 'linkedin'],
});

// Check status
const status = await workflows.getExecution(execution.id);

// Resume from any step
await workflows.resumeExecution(execution.id, 'publish');
```

## 💡 Utility Examples

```typescript
import {
  json,
  error,
  redirect,
  getClientIP,
  parseBody,
  isValidEmail,
  generateCacheKey,
  retry,
  sleep
} from '@umituz/web-cloudflare/utils';

// Response helpers
return json({ success: true }, 201);
return error('Not found', 404);
return redirect('/login');

// Request helpers
const ip = getClientIP(request);
const body = await parseBody<User>(request);

// Validation
if (!isValidEmail(email)) {
  return error('Invalid email', 400);
}

// Cache
const key = await generateCacheKey(request);
const hashKey = await hash(key);

// Retry with backoff
const result = await retry(
  () => fetch(url),
  { maxAttempts: 3, initialDelay: 1000 }
);

// Sleep
await sleep(1000); // 1 second
```

## 📋 Version Strategy

**Important:** This package follows a **patch-only versioning strategy**. Only the patch version will increment (e.g., 1.4.0 → 1.4.1 → 1.4.2). Major version bumps (2.0.0) will never occur. This ensures stability and prevents breaking changes from version updates.

## 📁 Example Files

Example files are located within their respective domains:
- **Worker Example**: `src/domains/workers/examples/worker.example.ts`

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome!

## 📦 Package Structure

```
@umituz/web-cloudflare/
├── src/
│   ├── config/              # Config patterns and types
│   ├── domains/             # Domain-driven design structure
│   │   ├── wrangler/        # Wrangler CLI domain
│   │   ├── workers/         # Workers domain
│   │   ├── ai-gateway/      # AI Gateway domain
│   │   ├── r2/              # R2 storage domain
│   │   ├── d1/              # D1 database domain
│   │   ├── kv/              # KV storage domain
│   │   ├── images/          # Images optimization domain
│   │   ├── analytics/       # Analytics domain
│   │   └── workflows/       # Workflows domain
│   ├── infrastructure/
│   │   ├── router/          # Express-like router
│   │   ├── middleware/      # Middleware collection
│   │   └── utils/           # Helper functions
│   └── presentation/
│       └── hooks/           # React hooks
└── package.json
```

## 🎯 Use Cases

- **Social Media Apps** - Content generation, multi-platform publishing
- **E-commerce** - Product APIs, cart management, payment processing
- **SaaS** - Subscription management, feature flags
- **API Gateway** - Rate limiting, caching, routing
- **CDN** - Static file serving, image optimization
- **AI-First Apps** - Content generation, sentiment analysis

Made with ❤️ by umituz
