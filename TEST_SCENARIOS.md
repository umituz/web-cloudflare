# @umituz/web-cloudflare — Manual Test Scenarios

This document lists the manual verification steps for every domain in the
package. Each scenario lists **how to invoke it**, the **success criteria**
you should observe, and the **failure modes** to watch for.

Run the typecheck and lint before exercising any scenario:

```bash
npm run typecheck    # → 0 errors
npm run lint         # → 0 errors
```

> Workers are exercised with `wrangler dev` (or `wrangler tail` against a
> deployed environment). Browser-side helpers are exercised with a small
> static page or by pasting snippets into DevTools.

---

## Table of contents

1. [Router](#1-router)
2. [Request / Response helpers](#2-request--response-helpers)
3. [Validation utilities](#3-validation-utilities)
4. [KV service](#4-kv-service)
5. [R2 service](#5-r2-service)
6. [D1 service](#6-d1-service)
7. [Workers service](#7-workers-service)
8. [Cache middleware](#8-cache-middleware)
9. [CORS middleware](#9-cors-middleware)
10. [Rate-limit middleware](#10-rate-limit-middleware)
11. [Auth middleware](#11-auth-middleware)
12. [Multi-tenant service](#12-multi-tenant-service)
13. [AI Gateway service](#13-ai-gateway-service)
14. [Workers AI service](#14-workers-ai-service)
15. [Audio streaming service](#15-audio-streaming-service)
16. [Analytics service](#16-analytics-service)
17. [Queues](#17-queues)
18. [Workflows](#18-workflows)
19. [Auth (Device + Token + WebDevice)](#19-auth-device--token--webdevice)
20. [Pages / React hooks](#20-pages--react-hooks)
21. [Configuration patterns](#21-configuration-patterns)

---

## 1. Router

### 1.1 Route matching
- **Invoke**: `router.get('/users/:id', handler)` then `GET /users/42`.
- **Success**: handler receives `params.id === '42'` and response is 200.
- **Failure**: 404 means the pattern was not matched (verify leading `/`).

### 1.2 Method routing
- **Invoke**: define `router.get('/x', g)` and `router.post('/x', p)`.
- **Success**: `GET /x` returns g's response; `POST /x` returns p's response.
- **Failure**: same response for both methods → method dispatch broken.

### 1.3 Global middlewares
- **Invoke**: `router.use(async (req) => req.headers.get('x-block') ? new Response('no', { status: 403 }) : null)`.
- **Success**: request with `x-block: 1` is short-circuited at 403; without
  the header it falls through to the handler.
- **Failure**: 403 never appears → middleware not invoked.

### 1.4 Route caching
- **Invoke**: enable route cache (default on) and call `router.handle()`
  with the same `(method, path)` repeatedly.
- **Success**: route resolution is observed to use the cache (no observable
  difference in behaviour, but add `console.log` inside the handler to
  count invocations; should match request count after the first miss).

### 1.5 Group routing with prefix
- **Invoke**: `router.group('/api', (r) => { r.get('/ping', …); })`.
- **Success**: `GET /api/ping` resolves to the inner handler.
- **Failure**: 404 → prefix not applied.

### 1.6 `params(request)` helper
- **Invoke**: inside a `/users/:id` handler call `params(request)`.
- **Success**: returns `{ id: '42' }`.
- **Failure**: returns `{}` → the request was not annotated by the router
  (you called the helper outside the router-managed request).

---

## 2. Request / Response helpers

### 2.1 `parseBody` — JSON
- **Invoke**: `POST /x` with `Content-Type: application/json` and body
  `{"a":1}`.
- **Success**: returns `{ a: 1 }`.

### 2.2 `parseBody` — URL-encoded
- **Invoke**: `POST /x` with `Content-Type: application/x-www-form-urlencoded`
  and body `a=1&b=2`.
- **Success**: returns `{ a: '1', b: '2' }`.

### 2.3 `parseBody` — text
- **Invoke**: `POST /x` with `Content-Type: text/plain` and body `hello`.
- **Success**: returns `'hello'`.

### 2.4 `parseBody` — unsupported
- **Invoke**: `POST /x` with `Content-Type: application/octet-stream`.
- **Success**: throws `Error('Unsupported content type: …')`.

### 2.5 `json(data, status?)`
- **Invoke**: `json({ ok: true }, 201)`.
- **Success**: response has `Content-Type: application/json` and status 201.

### 2.6 `error` / `notFound` / `unauthorized` / `forbidden` / `badRequest`
- **Success**: each returns a JSON error envelope with the matching status
  code (500 / 404 / 401 / 403 / 400).

### 2.7 `redirect`, `noContent`, `html`, `text`, `file`, `stream`
- **Success**: each returns a Response with the right `Content-Type`
  and status (302 / 204 / text/html / text/plain / supplied mime / supplied
  mime). `file` with a filename sets `Content-Disposition`.

---

## 3. Validation utilities

### 3.1 `isValidEmail`
- **Success**: `user@example.com` → `true`; `not-an-email` → `false`;
  `a@b.c` → `true`; `""` → `false`; very long (>254) → `false`.

### 3.2 `isValidURL`
- **Success**: `https://example.com` → `true`; `not a url` → `false`;
  `""` → `false`.

### 3.3 `isValidUUID`
- **Success**: `550e8400-e29b-41d4-a716-446655440000` → `true`;
  `not-a-uuid` → `false`; `""` → `false`.

### 3.4 `isValidPhone`
- **Success**: `+1 (555) 123-4567` → `true`; `123` → `false`; `""` → `false`.

### 3.5 `sanitize`
- **Success**: `<script>alert("xss")</script>` →
  `&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;`.

### 3.6 `truncate(text, n)` and `slugify(text)`
- **Success**: `truncate('hello world', 8)` → `'hello...'`;
  `slugify('Hello, World!')` → `'hello-world'`.

### 3.7 `parseDuration` / `formatDuration`
- **Success**: `parseDuration('5m')` → `300`; `formatDuration(3661)` →
  `'1h 1m 1s'`.

### 3.8 `retry` with exponential backoff
- **Invoke**: stub a function that fails twice then succeeds.
- **Success**: returns the success result; total time ≈ `initialDelay * 1`
  + `initialDelay * 2` (with default options).

### 3.9 `generateCacheKey`
- **Success**: identical `(method, pathname, sorted-query, auth-prefix)`
  inputs produce identical keys; auth header adds a salt to user-specific
  caching.

### 3.10 `parseCacheControl`
- **Success**: `Cache-Control: public, max-age=60, no-cache` →
  `{ maxAge: 60, noCache: true }`. Empty / malformed input returns `{}`.

### 3.11 `parseQueryParams(url)` and `query(request)`
- **Success**: `?a=1&a=2` returns `{ a: '2' }` (last wins for duplicates —
  current behaviour, matches URLSearchParams semantics).

---

## 4. KV service

### 4.1 Basic get/put/delete
- **Setup**: bind a real KV namespace via `kvService.bindNamespace('main', env.CACHE)`.
- **Steps**:
  1. `await kvService.put('hello', { foo: 'bar' }, { ttl: 60 })`
  2. `await kvService.get('hello')` → `{ foo: 'bar' }`
  3. `await kvService.delete('hello')` returns `true`
  4. `await kvService.get('hello')` returns `null`
- **Success**: each step returns the value above.
- **Failure**: type errors on the get call → JSON deserialization mismatch
  (the service stored a string, not a JSON object).

### 4.2 Hierarchical cache (L1 + L2)
- **Steps**:
  1. `kvService.putWithCache('k', { v: 1 }, { ttl: 60 })`
  2. `kvService.getWithCache('k')` → `{ v: 1 }` (from L1)
  3. Manually `kvService.clearL1Cache()` and re-read
  4. Result should still be `{ v: 1 }` (from L2)
- **Success**: works without re-fetching from origin.
- **Failure**: 4 returns `null` → L1 clear path bypassed the KV read.

### 4.3 Cache invalidation by pattern
- **Steps**: `warmCache([{ key: 'user:1', value: {…} }, …])` then
  `invalidatePattern('user:')`.
- **Success**: subsequent `get` for any matching key returns `null`.

### 4.4 Tag-based AI cache invalidation
- **Steps**:
  1. `cacheAIResponse('prompt1', { … }, { tags: ['campaignA'] })`
  2. `getCachedAIResponse('prompt1')` returns the response
  3. `invalidateTagged('campaignA')`
  4. `getCachedAIResponse('prompt1')` returns `null`
- **Success**: tag indexes are removed along with cached responses.

### 4.5 Invalid key throws
- **Success**: `kvService.put('', 'x')` throws `Invalid KV key: `.

---

## 5. R2 service

### 5.1 Basic put/get
- **Setup**: bind a real R2 bucket via `r2Service.bindBucket('main', env.STORAGE)`.
- **Steps**: `put('k', new TextEncoder().encode('hi'))` then
  `get('k')` returns `{ key: 'k', size: 2, uploaded: <Date> }`.
- **Success**: round-trip works.

### 5.2 `head()` metadata
- **Steps**: `head('k')` after a put.
- **Success**: returns `R2ObjectMetadata` with `size`, `uploaded`, `etag`,
  `httpMetadata`, and (where applicable) `customMetadata`.

### 5.3 `getBody()` with range
- **Steps**: put a 1 KB buffer, then `getBody('k', { range: { start: 0, end: 9 } })`.
- **Success**: returns the first 10 bytes as an `ArrayBuffer`.

### 5.4 `getPresignedURL()` public bucket
- **Steps**: configure `customDomain` for a public bucket, call
  `getPresignedURL('k')`.
- **Success**: returns the public URL; a `console.warn` explains that this
  is *not* a SigV4-signed URL.

### 5.5 Multipart upload helpers throw
- **Steps**: call `createMultipartUpload('k')`.
- **Success**: throws `Error: R2Service.createMultipartUpload: R2 bindings
  do not expose S3-style multipart uploads. Use @aws-sdk/client-s3 …`.
- **Failure**: silently returns a fake `uploadId` → code regressed to the
  stub behaviour and must be rejected.

### 5.6 Invalid key throws
- **Success**: `put('', data)` throws `Invalid R2 key: `.

### 5.7 `uploadGeneratedAsset` with D1 side-effect
- **Setup**: bind both R2 and D1.
- **Steps**: call `uploadGeneratedAsset(buffer, metadata, { saveToD1: true, tableName: 'assets' })`.
- **Success**: object appears in R2; row appears in D1 with
  `key / size / uploadedAt / model / provider / prompt / userId / tags`.

---

## 6. D1 service

### 6.1 Basic query
- **Setup**: bind a real D1 database with at least one table.
- **Steps**: `query<T>('SELECT * FROM users WHERE id = ?', [42])`.
- **Success**: returns `{ rows: […], meta: { duration, changes? } }`.

### 6.2 Insert / update / delete helpers
- **Steps**: `insert('users', { id: 'u1', email: 'a@b.c' })` then
  `update('users', { email: 'x@y.z' }, 'id = ?', ['u1'])` then
  `delete('users', 'id = ?', ['u1'])`.
- **Success**: each helper runs a single statement; row count updates as expected.

### 6.3 Transaction wrapper
- **Steps**:
  ```ts
  await d1.runInTransaction(async (tx) => {
    await tx.query('INSERT INTO accounts …');
    await tx.query('UPDATE users …');
    await tx.commit();
  });
  ```
- **Success**: both statements succeed; an exception rolls back via the
  `try/catch` in `runInTransaction` and `tx.rollback()`.

### 6.4 Query builder
- **Steps**: `d1.queryBuilder('users').select(['id','email']).where('is_active = ?', [1]).limit(10).toSQL()`.
- **Success**: returns `{ sql: 'SELECT id, email FROM users WHERE is_active = ? LIMIT 10', params: [1] }`.

### 6.5 Schema validation
- **Steps**: `validateSchema('users', { id: 'TEXT', email: 'TEXT' })`.
- **Success**: returns `{ valid: true/false, errors, warnings }` reflecting
  the actual `PRAGMA table_info` columns.

---

## 7. Workers service

### 7.1 Route handler invocation
- **Invoke**: `workersService.route('/api/ping', async () => new Response('pong'))`
  then `GET /api/ping`.
- **Success**: returns 200 with body `pong`.

### 7.2 Middleware short-circuit
- **Invoke**: register a middleware that returns a 401 Response.
- **Success**: route handler is not invoked; response is the 401.

### 7.3 JSON / error / redirect / cors helpers
- **Success**: each helper produces a Response with the expected
  `Content-Type` and status code (e.g. `redirect('/x', 301)` → 301 with
  `Location`).

### 7.4 Cached responses
- **Invoke**: `cached(request, 60, fetcher)` for a request that hits
  `caches.default`.
- **Success**: second call returns the cached response with
  `Cache-Control: public, max-age=60`.

---

## 8. Cache middleware

### 8.1 Cache hit
- **Invoke**: with `cache({ enabled: true, defaultTTL: 60 })`, call
  middleware on the same path twice and then `setCache(req, res)`.
- **Success**: the second `cache()` call returns the cloned response.

### 8.2 Bypass paths
- **Invoke**: set `bypassPaths: ['/admin']`.
- **Success**: requests to `/admin/...` return `null` (cache skipped).

### 8.3 Path-specific TTL
- **Invoke**: `paths: { '/api/products': 5 }`.
- **Success**: responses for `/api/products/*` expire after 5 s;
  everything else uses `defaultTTL`.

### 8.4 Invalidate
- **Invoke**: `setCache` several times then `invalidateCache('foo')`.
- **Success**: only keys containing the substring are removed; the rest
  remain in the in-memory store.

---

## 9. CORS middleware

### 9.1 Preflight
- **Invoke**: `OPTIONS /x` with `Origin: https://app.example.com` and a
  CORS config that allows that origin.
- **Success**: response carries `Access-Control-Allow-Origin`,
  `Allow-Methods`, `Allow-Headers`, and (if `maxAge` is set) `Max-Age`.

### 9.2 Wildcard origin
- **Invoke**: `allowedOrigins: ['*']`.
- **Success**: response has `Access-Control-Allow-Origin: *`.

### 9.3 Non-preflight
- **Invoke**: any non-OPTIONS request.
- **Success**: `cors()` returns `null` (no short-circuit). Use
  `addCorsHeaders` to inject headers into an existing response.

---

## 10. Rate-limit middleware

### 10.1 Under the limit
- **Invoke**: send 5 requests with `maxRequests: 10, window: 60`.
- **Success**: all 5 return `null` (allow).

### 10.2 Over the limit
- **Invoke**: send 11 requests in the same window.
- **Success**: the 11th returns 429 with a `Retry-After` header matching
  the seconds remaining in the window.

### 10.3 Whitelist
- **Invoke**: set `whitelist: ['1.2.3.4']` and request from that IP.
- **Success**: requests are always allowed regardless of count.

### 10.4 Cleanup
- **Success**: `rateLimitStore` size never exceeds `MAX_ENTRIES`; entries
  older than 1 hour are removed by `cleanupExpiredEntries()`.

---

## 11. Auth middleware

### 11.1 Bearer token (valid)
- **Invoke**: `Authorization: Bearer <valid>` with a config that defines
  `token` or `validateToken`.
- **Success**: returns `null` (pass-through).

### 11.2 Bearer token (invalid)
- **Success**: returns 401 with JSON `{ error: 'Invalid token' }`.

### 11.3 API key (valid / invalid)
- **Success**: matches the bearer case with the `X-API-Key` header.

### 11.4 Basic auth
- **Success**: `Authorization: Basic base64(user:pass)` matches configured
  credentials; otherwise 401.

### 11.5 `addUserContext`
- **Success**: the returned Request has the new `X-User-ID` and
  `X-User-Context` headers while preserving method and body.

---

## 12. Multi-tenant service

### 12.1 Register and resolve by hostname
- **Steps**:
  1. `multiTenantService.registerTenant({ slug: 'acme', config: {…} })`
  2. `multiTenantService.setTenantRoute(tenant.id, { hostname: 'acme.example.com' })`
  3. `multiTenantService.resolveTenant(new Request('https://acme.example.com/'))`
- **Success**: returns `{ tenant, route }` for the matching host.

### 12.2 Resolve by header
- **Steps**: register a route with `header: 'x-tenant'` and send
  `x-tenant: <id>`.
- **Success**: resolved to the same tenant.

### 12.3 Binding isolation
- **Steps**: `bindD1(tenantA, 'DB', env.DB)`, then look up `getTenantContext(tenantA)`.
- **Success**: `context.d1.get('DB') === env.DB`; other tenants see no D1.

### 12.4 `withTenant` scoping
- **Steps**:
  ```ts
  await multiTenantService.withTenant(tenantA, async () => {
    assert(multiTenantService.getCurrentTenantId() === tenantA);
  });
  assert(multiTenantService.getCurrentTenantId() === null);
  ```
- **Success**: the previous tenant is restored after the block.

> **Workers isolation note**: in-memory state is per-isolate. To share
> tenants across isolates, persist to D1/KV and rehydrate in your fetch
> handler.

---

## 13. AI Gateway service

### 13.1 Route via Workers AI binding
- **Setup**: pass `WorkersAIBinding` to the constructor.
- **Steps**: `await aiGateway.route({ model: '@cf/meta/llama-3.1-8b-instruct', prompt: 'hi' })`.
- **Success**: returns `{ content, usage, … }` with non-zero `usage.neurons`.

### 13.2 Provider fallback
- **Steps**: configure `fallbackProvider`; induce a failure on the primary.
- **Success**: response comes from the fallback; circuit breaker opens
  after 5 failures (`isProviderAvailable` returns `false`).

### 13.3 Cost tracking
- **Steps**: `aiGateway.getCostSummary()` after a successful call.
- **Success**: `totalCost > 0`, `totalNeurons > 0`, `byProvider[primary] > 0`.

### 13.4 Cache
- **Steps**: send the same request twice with `cacheKey`.
- **Success**: second call has `cached: true` and no additional cost.

### 13.5 Hugging Face URL
- **Steps**: configure a provider with `baseURL` containing
  `…/v1/{account_id}/{gateway_id}/huggingface`.
- **Success**: `buildHuggingFaceGatewayURL(model)` returns the
  Cloudflare AI Gateway URL.

---

## 14. Workers AI service

### 14.1 `callLLM`
- **Success**: returns `{ content, data, usage, model, id }`.

### 14.2 `generateSpeech` (MeloTTS)
- **Setup**: bind `AI`.
- **Steps**: `generateSpeech('hello world')`.
- **Success**: returns `{ audio: '<base64>', format: 'mp3', model: '@cf/myshell-ai/melotts' }`.

### 14.3 `generateSpeech` (Deepgram Aura)
- **Success**: same shape, but the model returns a `ReadableStream` which
  the service collects and base64-encodes.

### 14.4 `transcribeAudio`
- **Steps**: pass a base64-encoded `audio/wav` string.
- **Success**: returns `{ text, language?, model }`.

### 14.5 `selectModel`
- **Success**: returns a model id matching the `task` and `speed` filters.

---

## 15. Audio streaming service

### 15.1 Range request
- **Steps**: `streamRange(key, { start: 0, end: 1023 }, 1_000_000, 'audio/mpeg')`.
- **Success**: 206 response with `Content-Range: bytes 0-1023/1000000`.

### 15.2 Full download
- **Steps**: `streamFull(key, size, mime)`.
- **Success**: 200 response with full body and `Accept-Ranges` header.

### 15.3 `streamAudio` chunks
- **Steps**: read from the returned `ReadableStream` until done.
- **Success**: chunks concatenate to the original byte length; `onChunk`
  fires for each.

### 15.4 HLS playlist
- **Steps**: `generateHLSPlaylist(key, 10)` for a file with `duration` in
  its custom metadata.
- **Success**: returns a valid M3U8 string ending with `#EXT-X-ENDLIST`.

### 15.5 Waveform
- **Success**: returns an array of length `samples`, each value in `[0, 1]`.

### 15.6 R2 not configured
- **Success**: any call throws `R2 service not configured`.

---

## 16. Analytics service

### 16.1 Initialization
- **Success**: any call before `initialize()` throws `AnalyticsService not initialized`.

### 16.2 Track events
- **Steps**: `trackEvent`, `trackPageview`, `trackCustom`, `trackOutboundLink`, `trackTiming`.
- **Success**: each call returns without throwing; events accumulate in the
  in-memory queue.

### 16.3 `getAnalytics`
- **Success**: returns `{ siteId, events, metrics: { pageviews, uniqueVisitors } }`.

---

## 17. Queues

### 17.1 Send a message
- **Setup**: bind a real queue.
- **Steps**: `queueService.sendMessage('jobs', { task: 'email' })`.
- **Success**: returns a generated `id`; the queue receives the message.

### 17.2 Batch send
- **Steps**: `queueService.sendBatch('jobs', […])`.
- **Success**: returns `string[]` of ids; the queue receives all messages.

### 17.3 `processBatch` with retry
- **Steps**: provide a handler that throws; run `processBatch` with
  `withExponentialBackoff()`.
- **Success**: each message is retried up to `maxAttempts`; `BatchCompletedEvent`
  reports `failed > 0` if some exhausted retries.

### 17.4 Missing queue
- **Success**: `sendMessage('does-not-exist', body)` throws
  `Queue "does-not-exist" not found in bindings`.

---

## 18. Workflows

### 18.1 Create + execute step
- **Steps**:
  ```ts
  const instance = await workflowService.createInstance('w1', { params: {…} });
  await workflowService.executeStep(instance.id, 'step1', async () => 42);
  const status = await workflowService.getInstanceStatus(instance.id);
  ```
- **Success**: `status.completedSteps` includes `'step1'`,
  `status.stepResults.step1 === 42`.

### 18.2 Failed step
- **Steps**: execute a step whose handler throws.
- **Success**: instance status becomes `'failed'`, `error.step` is the
  step name, and `WorkflowFailedEvent` is emitted.

### 18.3 List / filter
- **Steps**: `listInstances({ status: 'completed', page: 1, perPage: 20 })`.
- **Success**: returns only completed instances, paginated, with
  `totalPages` set.

### 18.4 Send event
- **Steps**: `sendEvent(instance.id, { eventType: 'tick', eventData: 1 })`.
- **Success**: events are stored in `instance.metadata.events` and the
  call returns `true`.

---

## 19. Auth (Device + Token + WebDevice)

### 19.1 `registerDevice`
- **Setup**: bind D1 + KV.
- **Steps**: `registerDevice({ deviceId: 'dev-1' })` twice.
- **Success**: first call creates the user + initial credit transaction;
  second call returns the same user (no duplicates).

### 19.2 `signUp` + `login`
- **Steps**: `signUp({ email, password })` then `login({ email, password })`.
- **Success**: both calls return `AuthResponse` with a valid
  `sessionToken`. `login` with a wrong password throws `Invalid credentials`.

### 19.3 Session validation
- **Steps**: extract the bearer token from the previous response and call
  `validateSession(token)`.
- **Success**: returns `{ user, session }` with matching IDs.

### 19.4 Credit consume
- **Steps**: `consumeCredits(userId, 5, 'gen image')`.
- **Success**: transaction recorded; `getCreditBalance` shows the new
  `remaining`. Insufficient credits throws.

### 19.5 `revokeAllUserSessions`
- **Success**: all entries in `user_sessions` for the user are removed
  and the KV copies are deleted.

### 19.6 `webDeviceService` (browser only)
- **Steps**: in DevTools on a real page, run
  `const svc = new WebDeviceService(); svc.getDeviceId();`.
- **Success**: a UUID v4 is returned and persisted to `localStorage`; a
  second call returns the same id.
- **Failure**: throws `WebDeviceService must be used in a browser runtime`
  when called in a Worker / SSR context.

### 19.7 `TokenService`
- **Steps**: `tokenService.generateToken({ userId, sessionId, deviceId: null, isAnonymous: true })`.
- **Success**: token is a base64url string; `verifyToken` round-trips; an
  expired token returns `null`.

---

## 20. Pages / React hooks

> These files live in a separate tsconfig (`tsconfig.react.json`). They
> require a host app that brings `react`, `react-dom`, and DOM lib types.

### 20.1 `useAuth`
- **Steps**: render `<AIChat … />` (or your component) inside a host that
  provides `fetch`.
- **Success**: `useAuth()` exposes `{ user, sessionToken, loading, error,
  signIn, signOut }`.

### 20.2 `useAI`
- **Success**: streaming responses update the message list chunk by chunk.

### 20.3 `useFileUpload`
- **Success**: progress reaches 100% on success; the returned `key` and
  `url` match the upload.

### 20.4 `useWorkflow`
- **Success**: starts a workflow and returns a `workflowId`; status
  transitions through `running → completed`.

### 20.5 `useAPIClient`
- **Success**: `setAuthToken` updates the default `Authorization` header
  on subsequent requests.

---

## 21. Configuration patterns

### 21.1 `ConfigBuilder` end-to-end
- **Steps**:
  ```ts
  const cfg = ConfigBuilder.create()
    .withCache({ enabled: true, defaultTTL: 60 })
    .withRateLimit({ enabled: true, maxRequests: 100, window: 60 })
    .withAI({ enabled: true, defaultModel: '@cf/meta/llama-3.1-8b-instruct' })
    .build();
  ```
- **Success**: every `with*` call merges into the previous value; the
  final `cfg` matches expectations.

### 21.2 `validateConfig`
- **Success**: returns `{ valid: true }` for sane configs; reports errors
  for `cache.defaultTTL < 0`, `rateLimit.maxRequests < 1`, etc.

### 21.3 Pre-built configs
- **Success**: `socialMediaConfig`, `ecommerceConfig`, `saasConfig`,
  `cdnConfig`, `aiFirstConfig`, `aiReadyConfig`, `minimalConfig` all load
  without throwing.

### 21.4 `getEnvironmentConfig(env)`
- **Success**: `development` merges `minimalConfig + cors`;
  `production` returns `socialMediaConfig`; `staging` returns a tuned
  variant; unknown environments fall back to `minimalConfig`.

### 21.5 `loadConfigFromEnv`
- **Success**: `CF_CACHE_ENABLED=true` adds cache config; `CF_AI_ENABLED=true`
  adds AI config with the providers supplied via `CF_AI_PROVIDERS` (JSON
  parsed at load time).

---

## Appendix: verifying a build

After any change, run:

```bash
npm run typecheck   # 0 errors
npm run lint        # 0 errors
```

Both must report zero errors before the change is shippable. Warnings
(non-`error` lines) are tolerated and do not block release, but the
trend over time should be downward.
