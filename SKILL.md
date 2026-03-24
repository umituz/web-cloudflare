# @umituz/web-cloudflare - Integration Skill

## Overview

This skill provides comprehensive Cloudflare Workers & Pages integration with config-based patterns, middleware, router, workflows, and AI capabilities.

## What This Skill Does

Automatically sets up and configures:

- ✅ Cloudflare Workers with routing and middleware
- ✅ KV storage with intelligent caching
- ✅ R2 object storage
- ✅ D1 database
- ✅ AI Gateway with multi-provider support
- ✅ Workflows orchestration
- ✅ Pages deployment
- ✅ Wrangler CLI integration
- ✅ Rate limiting, CORS, security middleware
- ✅ Performance optimizations (memory leak prevention, LRU caching)

## When to Use This Skill

Use this skill when you want to:

1. **Build Cloudflare Workers** - Create serverless functions with routing
2. **Deploy to Cloudflare Pages** - Static site deployment with functions
3. **Add Edge Computing** - Global CDN with compute at the edge
4. **Implement AI Features** - Workers AI integration with emotion control
5. **Cache Content** - KV storage with automatic cleanup
6. **Rate Limit APIs** - Built-in rate limiting with memory management
7. **Orchestrate Workflows** - Long-running operations with retries
8. **Use Wrangler CLI** - TypeScript wrapper for deployment

## Quick Start Examples

### Basic Worker

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

### Using KV Cache

```typescript
import { kvService } from '@umituz/web-cloudflare/kv';

// Initialize
kvService.bindNamespace('default', env.CACHE);

// Use cache
const data = await kvService.getOrSet('users', async () => {
  return await fetchUsers();
}, { ttl: 300 });
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

### Workflows

```typescript
import { WorkflowService } from '@umituz/web-cloudflare/workflows';

const workflows = new WorkflowService({
  KV: env.KV,
  D1: env.D1
});

const execution = await workflows.startExecution('media-processing', {
  mediaUrl: 'https://example.com/video.mp4',
  operations: ['transcode', 'optimize']
});
```

## Performance Features

This skill includes automatic performance optimizations:

- **Memory Leak Prevention** - All caches auto-cleanup
- **Route Caching** - 80% faster route matching
- **LRU Eviction** - Intelligent cache management
- **Batch Operations** - Faster KV writes
- **Hit Rate Tracking** - Monitor cache effectiveness

## Subpath Exports

Import only what you need for optimal bundle size:

```typescript
// Workers
import { WorkersService } from '@umituz/web-cloudflare/workers';

// KV Cache
import { KVService } from '@umituz/web-cloudflare/kv';

// R2 Storage
import { R2Service } from '@umituz/web-cloudflare/r2';

// D1 Database
import { D1Service } from '@umituz/web-cloudflare/d1';

// AI Gateway
import { AIGatewayService } from '@umituz/web-cloudflare/ai-gateway';

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

## Configuration Examples

### Social Media App

```typescript
import { socialMediaConfig } from '@umituz/web-cloudflare/config';

const worker = new WorkerService({
  ...socialMediaConfig,
  env: {
    KV: env.KV,
    R2: env.R2,
    D1: env.D1,
    AI: env.AI,
  },
});
```

### Custom Config

```typescript
import { ConfigBuilder } from '@umituz/web-cloudflare/config';

const config = ConfigBuilder
  .create()
  .withCache({ enabled: true, defaultTTL: 300 })
  .withRateLimit({ enabled: true, maxRequests: 100, window: 60 })
  .withAI({ enabled: true })
  .build();
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

## Monitoring

```typescript
import { getCacheStats } from '@umituz/web-cloudflare/middleware';

// Add performance headers
const stats = getCacheStats();
response.headers.set('X-Cache-Hit-Rate', stats.hitRate.toString());
response.headers.set('X-Cache-Size', stats.size.toString());
```

## Best Practices

1. **Use Subpath Imports** - Better tree-shaking
2. **Enable Caching** - Set appropriate TTLs
3. **Rate Limit** - Protect your APIs
4. **Monitor Performance** - Check cache stats
5. **Handle Errors** - Use try-catch in workflows
6. **Cleanup Resources** - Let automatic cleanup handle it

## Troubleshooting

### High Memory Usage

```typescript
import { invalidateCache } from '@umituz/web-cloudflare/middleware';
invalidateCache(); // Clear all caches
```

### Slow Response Times

1. Check cache hit rate
2. Enable route caching
3. Use batch operations

### Rate Limiting Issues

Adjust limits or whitelist trusted IPs:

```typescript
const result = await checkRateLimit(request, {
  maxRequests: 1000,
  whitelist: ['admin-ip']
});
```

## Learn More

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Performance Guide](https://developers.cloudflare.com/workers/best-practices/)
