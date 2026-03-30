# @umituz/web-cloudflare - Özellikler Dokümantasyonu

Bu paket, Cloudflare Workers ve Pages için kapsamlı bir entegrasyon sağlar. Config tabanlı mimari, domain-driven design (DDD) yaklaşımı ve production-ready özellikler sunar.

**Version**: 1.5.0 (Major AI Building Blocks Release)

---

## 📋 İçindekiler

1. [Mimari](#mimari)
2. [Domain Hizmetleri](#domain-hizmetleri)
3. [AI Building Blocks](#ai-building-blocks) ⭐ YENİ
4. [Config Patterns](#config-patterns)
5. [Router & Middleware](#router--middleware)
6. [Workflows](#workflows)
7. [Utility Fonksiyonları](#utility-fonksiyonları)
8. [Performans Optimizasyonları](#performans-optimizasyonları)
9. [Kullanım Örnekleri](#kullanım-örnekleri)

---

## 🏗️ Mimari

### Domain-Driven Design (DDD)

Paket, DDD prensiplerine göre organize edilmiştir. Her domain kendi içinde:
- **Entities**: Veri modelleri ve tipler
- **Services**: İş mantığı ve operasyonlar
- **Types**: TypeScript tanımlamaları
- **Index**: Public API exports

Bu yapı sayesinde her domain bağımsız çalışabilir ve tree-shake friendly'dir.

### Layered Architecture

```
├── Domain Layer (İş mantığı)
│   ├── workers/      - Workers ve HTTP handling
│   ├── kv/           - Key-value storage (AI caching)
│   ├── r2/           - Object storage (AI assets)
│   ├── d1/           - Relational database (migrations, transactions)
│   ├── images/       - Image optimization
│   ├── analytics/    - Analytics tracking (AI costs)
│   ├── workflows/    - Long-running operations (AI pipelines)
│   ├── ai/           - AI building blocks ⭐ YENİ
│   ├── ai-gateway/   - AI Gateway (legacy)
│   ├── pages/        - Static deployment
│   ├── wrangler/     - CLI operations
│   ├── middleware/   - HTTP middleware (AI quota, auth)
│   └── multi-tenant/  - Multi-app support ⭐ YENİ
│
├── Infrastructure Layer (Teknik altyapı)
│   ├── router/       - HTTP routing
│   └── utils/        - Helper functions
│
└── Config Layer (Yapılandırma)
    ├── patterns.ts   - Pre-built configs
    └── types.ts      - Type definitions
```

---

## 🎯 Domain Hizmetleri

### 1. Workers Service (`/workers`)

**Amaç**: Cloudflare Workers için HTTP request handling ve response management

**Kullanım Alanları**:
- HTTP request processing
- Response formatting
- Error handling
- Request validation
- Environment ve context management

---

### 2. KV Service (`/kv`)

**Amaç**: Key-value storage için yüksek performanslı cache ve data persistence

**Kullanım Alanları**:
- Session storage
- API response caching
- Rate limiting counters
- Feature flags
- AI response caching (KV + L1 memory cache)
- Tagged cache invalidation

**Yeni Özellikler**:
- `cacheAIResponse()`: AI yanıtlarını önbelleğe alma
- `getCachedAIResponse()`: Önbelleğe alınmış AI yanıtlarını getirme
- `invalidateTagged()`: Etiket tabanlı cache invalidasyon
- `warmCache()`: Cache önceden ısıtma
- `getWithCache()`: Hierarchical L1 (memory) + L2 (KV) caching

---

### 3. R2 Service (`/r2`)

**Kullanım Alanları**:
- File uploads (images, videos, documents)
- Static asset hosting
- Media processing pipelines
- Backup storage
- User-generated content
- **AI-generated assets** (otomatik metadata kaydetme)

**Yeni Özellikler**:
- `putWithMetadata()`: R2'ye yüklerken otomatik D1'ye metadata kaydetme
- `getPresignedURL()`: Gerçek presigned URL (S3-compatible)
- `createMultipartUpload()`: Büyük dosyalar için multipart upload
- `uploadPart()`: Parça yükleme
- `completeMultipartUpload()`: Multipart upload tamamlama
- `getPublicURL()`: Public URL oluşturma
- `getSignedURL()`: Özel dosyalar için signed URL

---

### 4. D1 Service (`/d1`)

**Kullanım Alanları**:
- User data storage
- Transaction records
- Relational data management
- Complex queries
- **AI data persistence** (embeddings, vectors, sessions)

**Yeni Özellikler**:
- Migration sistemi:
  - `createMigration()`: Yeni migration oluşturma
  - `runMigration()`: Migration çalıştırma
  - `rollbackMigration()`: Migration geri alma
  - `getMigrationHistory()`: Migration geçmişi
- Transaction wrapper:
  - `runInTransaction<T>()`: Atomik transaction'lar
  - `D1TransactionWrapper`: Commit/rollback desteği
- Batch query helper:
  - `batchQuery<T>()`: Toplu sorgular
- Schema validation:
  - `validateSchema()`: Şema doğrulama
  - `getTableSchema()`: Tablo şema bilgisi
- Query builder:
  - `queryBuilder()`: Fluent API ile query oluşturma
  - `D1QueryBuilder`: select(), where(), join(), orderBy(), limit()

---

### 5. Images Service (`/images`)

**Kullanım Alanları**:
- Image optimization
- On-the-fly resizing
- Format conversion (WebP, AVIF)
- Quality adjustment
- Responsive images

---

### 6. Analytics Service (`/analytics`)

**Kullanım Alanları**:
- Request counting
- Response time tracking
- Error monitoring
- User analytics
- **AI cost tracking**: Neuron tüketimi, maliyet analizi
- **AI usage dashboard**: Provider kullanımı, cache hit rate

---

### 7. Workflows Service (`/workflows`)

**Kullanım Alanları**:
- Media processing pipelines
- Multi-step data processing
- Third-party API integrations
- Batch operations
- Async task execution

**Yeni AI Pipeline Templates**:
- `rag-pipeline`: RAG (Retrieval-Augmented Generation) pipeline
- `batch-embeddings`: Toplu embedding üretimi
- `ai-content-pipeline`: AI içerik üretim pipeline (validation, SEO, plagiarism check)
- `ai-multi-step-reasoning`: Chain-of-thought reasoning
- `ai-data-enrichment`: AI destekli veri zenginleştirme

---

### 8. Wrangler Service (`/wrangler`)

**Kullanım Alanları**:
- Authentication management
- Project creation and configuration
- Deployment automation
- Development server
- Resource management (KV, R2, D1)
- Secret management
- Monitoring and logging

---

### 9. Pages Service (`/pages`)

**Kullanım Alanları**:
- Static site deployment
- Project creation
- Deployment management
- Environment variables
- Branch-based deployments

---

### 10. Middleware Services (`/middleware`)

**Kullanım Alanları**:
- CORS handling
- Caching strategies
- Rate limiting
- Authentication/Authorization
- Security headers
- Request logging

**Yeni Auth & Security Özellikleri**:
- `requireAuth()`: Enhanced auth with user validation ve access logging
- `requireAIQuota()`: AI-specific rate limiting (neuron-based)
- `SessionManager`: D1 + KV session yönetimi
  - `createSession()`: Yeni session oluşturma
  - `validateSession()`: Session doğrulama
  - `refreshSession()`: Session yenileme
  - `destroySession()`: Session silme
  - `destroyUserSessions()`: Kullanıcının tüm session'larını silme
- `checkUserQuota()`: User-based quota tracking
- `checkAIQuota()`: AI neuron quota checking

---

## 🤖 AI Building Blocks

**Yeni `/ai` domain** - Genel amaçlı AI building blocks

### 1. WorkersAIService (`/ai`)

**Amaç**: Generic LLM çağrıları, streaming, neuron tracking, cost estimation

**Özellikler**:
- Generic LLM calls (type-safe inputs)
- Server-Sent Events (SSE) streaming
- Model selection helper (requirements-based)
- Neuron tracking (Cloudflare billing metric)
- Cost estimation per model
- Embedding generation
- Translation (100+ languages)

**Kullanım**:
```typescript
import { WorkersAIService } from '@umituz/web-cloudflare/ai';

const ai = new WorkersAIService({ bindings: { AI: env.AI } });

// Generic LLM call
const response = await ai.callLLM('@cf/meta/llama-3.1-8b-instruct', {
  prompt: 'Hello, AI!',
  parameters: { temperature: 0.7, maxTokens: 1000 },
}, { stream: false, trackNeurons: true, trackCost: true });

// Streaming
const stream = ai.streamLLM('@cf/meta/llama-3.1-8b-instruct', {
  prompt: 'Tell me a story',
});

// Model selection
const model = ai.selectModel({
  task: 'chat',
  speed: 'fast',
  costSensitive: true,
});
```

**Desteklenen Modeller**:
- `@cf/meta/llama-3.1-8b-instruct`: General purpose
- `@cf/meta/llama-3.3-70b-instruct`: High quality
- `@cf/mistral/mistral-7b-instruct`: Fast & efficient
- `@cf/openai/clip-vit-base-patch32`: Embeddings
- `@cf/stabilityai/stable-diffusion-xl-base-1.0`: Image generation

---

### 2. EmbeddingService (`/ai`)

**Amaç**: Text ve image embedding generation, similarity calculation

**Özellikler**:
- Text embedding generation (tek/batch)
- Image embedding generation
- Batch processing (parallel)
- Cosine similarity calculation
- Most similar finder

**Kullanım**:
```typescript
import { EmbeddingService } from '@umituz/web-cloudflare/ai';

const embeddings = new EmbeddingService({ bindings: { AI: env.AI } });

// Text embedding
const embedding = await embeddings.generateTextEmbedding('Hello world');

// Batch embeddings
const embeddings = await embeddings.batchEmbeddings(['text1', 'text2', 'text3'], {
  batchSize: 100,
});

// Similarity
const similarity = embeddings.calculateSimilarity(embedding1, embedding2);

// Most similar
const { index, score } = embeddings.findMostSimilar(query, candidates);
```

---

### 3. VectorizeService (`/ai`)

**Amaç**: Vector index management, semantic search, RAG primitives

**Özellikler**:
- Multi-index binding support
- Upsert vectors with metadata
- Semantic search (top-K)
- RAG query (context building)
- Index statistics

**Kullanım**:
```typescript
import { VectorizeService } from '@umituz/web-cloudflare/ai';

const vectorize = new VectorizeService();
vectorize.bindIndex('documents', env.VECTORIZE_INDEX);

// Upsert vectors
await vectorize.upsert([
  { id: 'doc1', values: [0.1, 0.2, ...], metadata: { title: 'Doc 1' } },
  { id: 'doc2', values: [0.3, 0.4, ...], metadata: { title: 'Doc 2' } },
]);

// Semantic search
const results = await vectorize.query(queryVector, {
  topK: 10,
  binding: 'documents',
});

// RAG query
const ragResult = await vectorize.ragQuery(
  queryVector,
  [
    { id: 'doc1', text: 'Content 1', metadata: { source: 'web' } },
    { id: 'doc2', text: 'Content 2', metadata: { source: 'db' } },
  ],
  { topK: 5, binding: 'documents' }
);
```

---

### 4. LLMStreamingService (`/ai`)

**Amaç**: Generic streaming support for any LLM provider

**Özellikler**:
- Multi-provider streaming (Workers AI, OpenAI, Anthropic)
- SSE to async generator converter
- Stream accumulator

**Kullanım**:
```typescript
import { LLMStreamingService } from '@umituz/web-cloudflare/ai';

const streaming = new LLMStreamingService();

// Stream Workers AI
const stream = streaming.streamRequest('workers-ai', '@cf/meta/llama-3.1-8b-instruct', {
  prompt: 'Tell me a joke',
});

// Convert to generator
for await (const chunk of streaming.streamToGenerator(stream)) {
  console.log(chunk.content);
}

// Accumulate full response
const fullText = await streaming.accumulateStream(stream, (chunk) => {
  console.log('Chunk:', chunk);
});
```

---

### 5. AIGatewayService (`/ai`)

**Amaç**: Multi-provider routing, caching, fallback, cost tracking

**Özellikler**:
- Multi-provider routing (load balancing)
- KV-based caching (exact match)
- Semantic caching (embedding-based)
- Automatic fallback
- Circuit breaker pattern
- Cost tracking per provider/model
- Budget enforcement
- Analytics

**Kullanım**:
```typescript
import { AIGatewayService } from '@umituz/web-cloudflare/ai';

const gateway = new AIGatewayService(
  {
    gatewayId: 'my-gateway',
    providers: [
      {
        id: 'workers-ai',
        name: 'Workers AI',
        type: 'workers-ai',
        baseURL: '',
        apiKey: '',
        models: ['@cf/meta/llama-3.1-8b-instruct'],
        weight: 3,
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
    budget: {
      monthlyLimit: 100,
      alertThreshold: 80,
    },
  },
  env.KV,
  embeddingService
);

// Route request
const response = await gateway.route({
  model: '@cf/meta/llama-3.1-8b-instruct',
  prompt: 'Hello!',
  cacheKey: 'greeting:hello',
});

// Cost summary
const costs = await gateway.getCostSummary('month');
console.log('Total cost:', costs.totalCost);

// Check budget
const withinBudget = gateway.enforceBudget(100);
```

---

## 🔧 Config Patterns

### Pre-built Configurations

#### 1. Social Media App
- Aggressive caching (posts, feed, trending)
- Moderate rate limiting
- AI enabled for content generation
- Workflows enabled

#### 2. E-commerce App
- Short cache for products
- No cache for cart
- Higher rate limit
- AI disabled by default

#### 3. SaaS App
- Moderate caching
- Strict rate limiting
- AI enabled

#### 4. API Gateway
- Short cache TTL
- High rate limit (1000 req/min)
- CORS enabled
- Analytics enabled

#### 5. CDN
- 24-hour cache TTL
- No rate limiting
- Compression enabled
- Image optimization enabled

#### 6. AI-First App
- Multi-provider AI (Workers AI + OpenAI)
- 2-hour cache TTL
- Low rate limit (30 req/min)

#### 7. AI-Ready Config ⭐ YENİ
- 1-hour cache for AI responses
- User-based rate limiting (100 req/min)
- Multi-provider AI with fallback
- Vectorize enabled
- Neuron quota tracking (10M neurons/day)
- Cost tracking and budget enforcement ($100/month)
- AI analytics enabled

**Kullanım**:
```typescript
import { aiReadyConfig, ConfigBuilder } from '@umituz/web-cloudflare/config';

// Pre-built config
const worker = new WorkerService({
  ...aiReadyConfig,
  env: { KV: env.KV, R2: env.R2, D1: env.D1, AI: env.AI, VECTORIZE: env.VECTORIZE },
});

// Custom config with AI methods
const customConfig = ConfigBuilder
  .create()
  .withCache({ enabled: true, defaultTTL: 3600 })
  .withRateLimit({ enabled: true, maxRequests: 100, window: 60 })
  .withAIGateway({
    providers: [/* ... */],
    cacheEnabled: true,
    cacheTTL: 7200,
  })
  .withAIModels(['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.3-70b-instruct'])
  .withAICaching(true, 7200)
  .withAIQuota(10000000, 86400) // 10M neurons/day
  .withVectorize(true, ['documents', 'embeddings'])
  .withCostTracking(100, 80)
  .build();
```

---

## 🛣️ Router & Middleware

### Router Features

Express-style router ile HTTP endpoint tanımlama:

- **HTTP Methods**: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, ALL
- **Route Patterns**: Static paths, dynamic params, wildcards
- **Route Groups**: Prefix-based grouping
- **Resource Routes**: CRUD helpers
- **Response Helpers**: json(), success(), fail(), validationError()

### Middleware Features

- **CORS**: Origin validation, method filtering
- **Cache**: Response caching with TTL, cache statistics
- **Rate Limiting**: IP/user/custom key-based
- **Auth**: Enhanced with user validation, session management
- **AI Quota**: Neuron-based rate limiting for AI calls

---

## 🔄 Workflows

### Workflow Concepts

- **Named step sequences**
- **Dependencies between steps**
- **Retry policies with exponential backoff**
- **Idempotency guarantees** (safe to retry)
- **State persistence** (KV + D1)
- **Resume capability** (from any step)

### AI Pipeline Templates

#### 1. RAG Pipeline
```
1. embed-query → Generate query embedding
2. search-vectors → Search vector index for similar documents
3. build-context → Build context from retrieved documents
4. generate-response → Generate AI response with context
```

#### 2. Batch Embeddings
```
1. fetch-batch → Fetch batch of texts to embed
2. generate-embeddings → Generate embeddings in parallel
3. upsert-vectors → Upsert vectors to Vectorize
4. save-metadata → Save metadata to D1
```

#### 3. AI Content Pipeline
```
1. generate-draft → Generate initial content
2. validate-content → Validate quality
3. optimize-seo → Optimize for SEO
4. check-plagiarism → Check for plagiarism
5. save-to-database → Save final content
6. cache-to-kv → Cache content
```

#### 4. Multi-Step Reasoning
```
1. analyze-problem → Analyze problem statement
2. decompose-steps → Break down into steps
3. solve-each-step → Solve each step sequentially
4. synthesize-solution → Combine solutions
5. verify-solution → Verify correctness
```

#### 5. AI Data Enrichment
```
1. fetch-data → Fetch raw data
2. extract-entities → Extract entities and relationships
3. classify-content → Classify by category
4. generate-summary → Generate summary
5. enrich-metadata → Enrich with additional data
6. save-enriched → Save enriched data
```

---

## ⚛️ React Hooks for Cloudflare Pages

**Package**: `@umituz/web-cloudflare/pages/react`

The package provides production-ready React hooks for building Cloudflare Pages applications with Workers backend.

### Available Hooks

#### `useAuth` - Authentication Management
```tsx
import { useAuth } from '@umituz/web-cloudflare/pages/react';

function LoginPage() {
  const { authState, login, logout } = useAuth({
    baseURL: '/api',
  });

  const handleLogin = async () => {
    await login({ email: 'user@example.com', password: 'password' });
  };

  if (authState.isLoading) return <div>Loading...</div>;

  return (
    <div>
      {authState.isAuthenticated ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
}
```

#### `useAI` - AI Text Generation & Streaming
```tsx
import { useAI } from '@umituz/web-cloudflare/pages/react';

function ChatComponent() {
  const { aiState, generateText, streamText } = useAI({
    baseURL: '/api',
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
  });

  const handleGenerate = async () => {
    const response = await generateText('Write a poem about edge computing');
    console.log(response.content);
  };

  const handleStream = async () => {
    await streamText('Tell me a story', (chunk) => {
      console.log('Stream chunk:', chunk);
    });
  };

  return (
    <div>
      <button onClick={handleGenerate}>Generate</button>
      <button onClick={handleStream}>Stream</button>
      {aiState.isLoading && <div>Generating...</div>}
      {aiState.response && <div>{aiState.response.content}</div>}
    </div>
  );
}
```

#### `useAIChat` - Chat Interface with History
```tsx
import { useAIChat } from '@umituz/web-cloudflare/pages/react';

function ChatInterface() {
  const { messages, aiState, sendMessage, clearConversation } = useAIChat({
    baseURL: '/api',
    systemPrompt: 'You are a helpful assistant.',
  });

  const handleSend = async (message: string) => {
    await sendMessage(message, { stream: true });
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
      {aiState.isStreaming && <div>Typing...</div>}
    </div>
  );
}
```

#### `useFileUpload` - R2 File Upload with Progress
```tsx
import { useFileUpload } from '@umituz/web-cloudflare/pages/react';

function FileUploader() {
  const { uploadState, selectFile, uploadFile } = useFileUpload({
    baseURL: '/api',
    path: '/upload',
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['image/jpeg', 'image/png'],
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectFile(e.target.files[0]);
      uploadFile();
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      {uploadState.isLoading && (
        <div>Uploading: {uploadState.progress}%</div>
      )}
      {uploadState.url && (
        <div>Uploaded: <a href={uploadState.url}>{uploadState.key}</a></div>
      )}
    </div>
  );
}
```

#### `useWorkflow` - Workflow Execution & Monitoring
```tsx
import { useWorkflow } from '@umituz/web-cloudflare/pages/react';

function WorkflowRunner() {
  const { workflowState, executeWorkflow, cancelExecution } = useWorkflow({
    baseURL: '/api',
    pollInterval: 1000,
    onWorkflowComplete: (execution) => {
      console.log('Workflow completed:', execution.result);
    },
  });

  const handleExecute = async () => {
    await executeWorkflow('rag-pipeline', { query: 'What is AI?' });
  };

  return (
    <div>
      <button onClick={handleExecute}>Execute RAG Pipeline</button>
      {workflowState.execution && (
        <div>
          <div>Status: {workflowState.execution.status}</div>
          {workflowState.execution.steps.map((step, i) => (
            <div key={i}>
              {step.name}: {step.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### React Components

#### `<FileUpload>` - Dropzone File Upload Component
```tsx
import { FileUpload } from '@umituz/web-cloudflare/pages/react';

function MyForm() {
  return (
    <FileUpload
      onUploadComplete={(data) => console.log('Uploaded:', data)}
      maxSize={50 * 1024 * 1024}
      accept="image/*"
      dropzoneText="Drag and drop images here"
    />
  );
}
```

#### `<AIChat>` - AI Chat Interface Component
```tsx
import { AIChat } from '@umituz/web-cloudflare/pages/react';

function ChatPage() {
  return (
    <AIChat
      baseURL="/api"
      placeholder="Ask me anything..."
      welcomeMessage="Hello! How can I help you?"
      showTimestamp={true}
      systemPrompt="You are a helpful assistant."
      onMessageSend={(msg) => console.log('Sent:', msg)}
      onMessageReceive={(msg) => console.log('Received:', msg)}
    />
  );
}
```

---

## 🏢 Multi-Tenant Support

**Package**: `@umituz/web-cloudflare/multi-tenant`

Manage multiple D1, R2, KV, and Vectorize bindings for multi-tenant applications.

### Tenant Management

```typescript
import { multiTenantService } from '@umituz/web-cloudflare/multi-tenant';

// Register a new tenant
const tenant = await multiTenantService.registerTenant({
  name: 'Acme Corp',
  slug: 'acme',
  domain: 'acme.example.com',
  config: {
    d1Bindings: ['DB'],
    r2Bindings: ['STORAGE'],
    kvNamespaces: ['CACHE'],
    vectorizeIndexes: ['DOCUMENTS'],
  },
});

// Bind resources
multiTenantService.bindD1(tenant.id, 'DB', env.DB);
multiTenantService.bindR2(tenant.id, 'STORAGE', env.STORAGE);
multiTenantService.bindKV(tenant.id, 'CACHE', env.CACHE);
multiTenantService.bindVectorize(tenant.id, 'DOCUMENTS', env.VECTORIZE);
```

### Tenant Routing

```typescript
// Set up routing strategy
multiTenantService.setTenantRoute(tenant.id, {
  hostname: 'acme.example.com', // Route by hostname
  // OR
  header: 'X-Tenant-ID', // Route by header
  // OR
  query: 'tenant', // Route by query parameter
});

// Resolve tenant from request
export default {
  async fetch(request, env, ctx) {
    const result = await multiTenantService.resolveTenant(request);

    if (!result) {
      return new Response('Tenant not found', { status: 404 });
    }

    const { tenant, route } = result;

    // Get tenant context with all bindings
    const context = multiTenantService.getTenantContext(tenant.id);
    const db = context.d1?.get('DB');
    const storage = context.r2?.get('STORAGE');

    // Handle request with tenant-specific resources
    return new Response('Hello from ' + tenant.name);
  },
};
```

### Tenant Isolation

```typescript
// Execute operation with tenant context
await multiTenantService.withTenant(tenant.id, async (context) => {
  const db = context.d1?.get('DB');

  // All database operations are isolated to this tenant
  const result = await db.prepare('SELECT * FROM users WHERE tenant_id = ?')
    .bind(tenant.id)
    .all();

  return result;
});
```

### Data Operations

```typescript
// Get tenant-specific KV key
const key = multiTenantService.getTenantKVKey(tenant.id, 'user:123');
// Returns: "acme:user:123"

// Get tenant-specific R2 prefix
const prefix = multiTenantService.getTenantR2Prefix(tenant.id);
// Returns: "acme/"

// Get tenant-specific D1 table
const table = multiTenantService.getTenantD1Table(tenant.id, 'users');
// Returns: "acme_users"
```

### Use Cases

- **SaaS Platforms**: Each customer gets isolated D1 database and R2 bucket
- **White-Label Applications**: Multiple brands with custom domains
- **Multi-Region Deployments**: Region-specific tenant routing
- **Development/Staging/Production**: Environment-based tenant isolation

---

## 💡 Kullanım Örnekleri

### RAG Implementation

```typescript
import { WorkersAIService, EmbeddingService, VectorizeService } from '@umituz/web-cloudflare/ai';

const ai = new WorkersAIService({ bindings: { AI: env.AI } });
const embeddings = new EmbeddingService({ bindings: { AI: env.AI } });
const vectorize = new VectorizeService();
vectorize.bindIndex('documents', env.VECTORIZE);

// 1. Index documents
const docs = [
  { id: 'doc1', text: 'Cloudflare Workers is fast', source: 'docs' },
  { id: 'doc2', text: 'Edge computing is the future', source: 'blog' },
];

for (const doc of docs) {
  const embedding = await embeddings.generateTextEmbedding(doc.text);
  await vectorize.upsert([{
    id: doc.id,
    values: embedding,
    metadata: { text: doc.text, source: doc.source },
  }]);
}

// 2. RAG query
const query = 'What is edge computing?';
const queryEmbedding = await embeddings.generateTextEmbedding(query);
const ragResult = await vectorize.ragQuery(
  queryEmbedding,
  docs.map(d => ({ id: d.id, text: d.text, metadata: { source: d.source } })),
  { topK: 3 }
);

// 3. Generate response with context
const response = await ai.callLLM('@cf/meta/llama-3.1-8b-instruct', {
  prompt: `Context: ${ragResult.context}\n\nQuestion: ${query}\n\nAnswer:`,
});
```

### AI Content Generation with Quality Control

```typescript
import { WorkflowService, WORKFLOW_TEMPLATES } from '@umituz/web-cloudflare/workflows';

const workflows = new WorkflowService({
  KV: env.KV,
  D1: env.D1,
  maxExecutionTime: 600,
});

// Create custom AI content workflow
await workflows.createWorkflow({
  id: 'blog-post-generator',
  name: 'Blog Post Generator with Quality Control',
  steps: [
    {
      id: 'generate-draft',
      name: 'Generate Initial Draft',
      handler: 'ai-generate-draft',
      timeout: 60,
    },
    {
      id: 'validate-quality',
      name: 'Validate Content Quality',
      handler: 'content-validate-quality',
      dependencies: ['generate-draft'],
      timeout: 10,
    },
    {
      id: 'optimize-seo',
      name: 'Optimize for SEO',
      handler: 'ai-optimize-seo',
      dependencies: ['validate-quality'],
      timeout: 30,
    },
    {
      id: 'check-plagiarism',
      name: 'Check for Plagiarism',
      handler: 'content-check-plagiarism',
      dependencies: ['optimize-seo'],
      timeout: 20,
    },
    {
      id: 'save-post',
      name: 'Save Blog Post',
      handler: 'd1-insert-content',
      dependencies: ['check-plagiarism'],
      timeout: 10,
    },
  ],
});

// Execute workflow
const execution = await workflows.startExecution('blog-post-generator', {
  topic: 'Cloudflare Workers AI',
  tone: 'professional',
  keywords: ['edge computing', 'serverless'],
});

// Check status
const status = await workflows.getExecution(execution.id);
```

### Cost Tracking and Budget Management

```typescript
import { AIGatewayService } from '@umituz/web-cloudflare/ai';

const gateway = new AIGatewayService(config, env.KV);

// Track AI calls automatically
await gateway.route({
  model: '@cf/meta/llama-3.1-8b-instruct',
  prompt: 'Generate content',
});

// Get cost summary
const summary = await gateway.getCostSummary('month');
console.log('Total cost:', summary.totalCost);
console.log('By provider:', summary.byProvider);
console.log('By model:', summary.byModel);

// Check budget
const withinBudget = gateway.enforceBudget(100); // $100 limit
if (!withinBudget) {
  console.log('Budget exceeded!');
}

// Get detailed analytics
const analytics = await gateway.getAnalytics();
console.log('Cache hit rate:', analytics.cacheHitRate);
console.log('Total requests:', analytics.totalRequests);
```

---

## ⚡ Performans Optimizasyonları

### Memory Management

- **Route Caching**: 80% faster subsequent requests (0.1ms vs 0.5ms)
- **LRU Cache Eviction**: Automatic cleanup of expired entries
- **Batch Operations**: KV writes batched for 50% improvement
- **Hierarchical Caching**: L1 (memory) + L2 (KV) for optimal performance

### AI-Specific Optimizations

- **Semantic Caching**: Embedding-based cache matching (90%+ similarity threshold)
- **Neuron Tracking**: Accurate billing metric tracking
- **Cost Estimation**: Real-time cost calculation per model
- **Circuit Breaker**: Automatic fallback on provider failures
- **Quota Enforcement**: Neuron-based rate limiting

---

## 📦 Subpath Exports

Her feature bağımsız import edilebilir:

```typescript
// AI building blocks (NEW!)
import { WorkersAIService, EmbeddingService, VectorizeService } from '@umituz/web-cloudflare/ai';
import { AIGatewayService, LLMStreamingService } from '@umituz/web-cloudflare/ai';

// Enhanced services
import { D1Service, D1QueryBuilder } from '@umituz/web-cloudflare/d1';
import { R2Service, R2MetadataWithD1 } from '@umituz/web-cloudflare/r2';
import { KVService, AIResponseCacheOptions } from '@umituz/web-cloudflare/kv';
import { WorkflowService, WORKFLOW_TEMPLATES } from '@umituz/web-cloudflare/workflows';

// Middleware
import { requireAuth, requireAIQuota, SessionManager } from '@umituz/web-cloudflare/middleware';
import { checkUserQuota, checkAIQuota } from '@umituz/web-cloudflare/middleware';

// Config
import { aiReadyConfig, ConfigBuilder } from '@umituz/web-cloudflare/config';

// React hooks (NEW! - for Cloudflare Pages)
import { useAuth, useAI, useFileUpload, useWorkflow } from '@umituz/web-cloudflare/pages/react';
import { FileUpload, AIChat } from '@umituz/web-cloudflare/pages/react';

// Multi-tenant support (NEW!)
import { multiTenantService, MultiTenantService } from '@umituz/web-cloudflare/multi-tenant';
```

---

## 🚀 Quick Start

### 1. Installation

```bash
npm install @umituz/web-cloudflare
```

### 2. AI-Ready Worker Setup

```typescript
import { aiReadyConfig, WorkerService } from '@umituz/web-cloudflare/config';
import { createRouter } from '@umituz/web-cloudflare/router';
import { cors, requireAIQuota } from '@umituz/web-cloudflare/middleware';
import { WorkersAIService, EmbeddingService, VectorizeService } from '@umituz/web-cloudflare/ai';

// Initialize AI services
const ai = new WorkersAIService({ bindings: { AI: env.AI } });
const embeddings = new EmbeddingService({ bindings: { AI: env.AI } });
const vectorize = new VectorizeService();
vectorize.bindIndex('docs', env.VECTORIZE);

// Create worker with AI-ready config
const worker = new WorkerService({
  ...aiReadyConfig,
  env: {
    KV: env.KV,
    R2: env.R2,
    D1: env.D1,
    AI: env.AI,
    VECTORIZE: env.VECTORIZE,
  },
});

// Setup router
const router = createRouter()
  .use(cors)
  .use((req) => requireAIQuota(req, {
    enabled: true,
    quota: 10000000,
    period: 86400,
    kv: env.KV,
  }))
  .post('/api/ai/generate', async (req) => {
    const body = await req.json();
    const response = await ai.callLLM('@cf/meta/llama-3.1-8b-instruct', {
      prompt: body.prompt,
    });
    return json(response);
  })
  .post('/api/embeddings', async (req) => {
    const body = await req.json();
    const embedding = await embeddings.generateTextEmbedding(body.text);
    return json({ embedding });
  })
  .post('/api/search', async (req) => {
    const body = await req.json();
    const queryEmbedding = await embeddings.generateTextEmbedding(body.query);
    const results = await vectorize.query(queryEmbedding, { topK: 10 });
    return json({ results });
  });

export default {
  fetch: (req, env, ctx) => router.handle(req, env, ctx),
};
```

---

## 🎯 Use Cases

### AI-Powered Applications
- **RAG Applications**: Document search, knowledge bases, Q&A systems
- **Content Generation**: Blogs, social media, marketing copy
- **Data Enrichment**: Entity extraction, classification, summarization
- **Multi-Step Reasoning**: Complex problem solving, analysis tasks

### E-Commerce
- Product recommendations with AI
- Dynamic pricing
- Inventory forecasting
- Customer support chatbots

### SaaS
- AI-powered feature recommendations
- Usage analytics with AI insights
- Automated content moderation
- Intelligent search

---

## 📝 Version Stratejisi

**Important**: Bu paket patch-only version strategy kullanır:
- Sadece patch versiyonu artar (ör: 1.5.0 → 1.5.1)
- Major versiyon değişikliği olmaz (2.0.0 asla)
- Bu sayede stabilite sağlanır ve breaking changes önlenebilir

---

## 🔗 Kaynaklar

- **GitHub**: https://github.com/umituz/web-cloudflare
- **NPM**: https://www.npmjs.com/package/@umituz/web-cloudflare
- **Cloudflare Docs**: https://developers.cloudflare.com/

---

**Made with ❤️ by umituz**

*Last Updated: March 2026*
