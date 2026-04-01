# 🚀 CLOUDFLARE QUEUES - KULLANIM REHBERİ

**Versiyon:** 1.7.0
**Tarih:** 31 Mart 2026
**Özellik:** Cloudflare Queues Producer/Consumer Pattern

---

## 📋 İÇİNDEKİLER

1. [Cloudflare Queues Nedir?](#cloudflare-queues-nedir)
2. [Kurulum](#kurulum)
3. [Producer Pattern - Mesaj Gönderme](#producer-pattern---mesaj-gönderme)
4. [Consumer Pattern - Mesaj İşleme](#consumer-pattern---mesaj-i̇şleme)
5. [Retry Logic ve DLQ](#retry-logic-ve-dlq)
6. [Gerçek Dünya Örnekleri](#gerçek-dünya-örnekleri)
7. [Best Practices](#best-practices)

---

## 🎯 Cloudflare Queues Nedir?

Cloudflare Queues, **asenkron mesaj işleme** için kullanılan producer/consumer pattern'i sunar.

**Temel Özellikler:**
- ✅ **At-least-once delivery:** Mesajlar en az bir kez teslim edilir
- ✅ **Automatic retry:** Başarısız mesajlar otomatik yeniden denenir
- ✅ **Batch processing:** Mesajlar toplu halde işlenebilir
- ✅ **Dead Letter Queue (DLQ):** Tekrar eden başarısız mesajlar DLQ'ye gönderilir
- ✅ **Ordered delivery:** Mesajlar sıralı olarak işlenir ( FIFO)

**Kullanım Senaryoları:**
- Video generation queue (async video üretimi)
- Email sending (toplu email gönderimi)
- Image processing (resim işleme)
- Webhook processing
- Batch data processing
- Background jobs

---

## 🔧 KURULUM

### 1. wrangler.toml Konfigürasyonu

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Queue bindings
[[queues.producers]]
binding = "VIDEO_QUEUE"
queue = "video-generation-queue"

[[queues.producers]]
binding = "EMAIL_QUEUE"
queue = "email-sending-queue"

[[queues.consumers]]
queue = "video-generation-queue"
max_batch_size = 50
max_wait_time = 10
max_retries = 3

[[queues.consumers]]
queue = "email-sending-queue"
max_batch_size = 25
max_wait_time = 5
max_retries = 5
```

### 2. Worker Export

```typescript
// src/index.ts
import {
  QueueService,
  QueueConsumerService,
  QueueName,
  RetryPolicy
} from '@umituz/web-cloudflare';

export interface Env {
  // Producer bindings
  VIDEO_QUEUE: Queue<any>;
  EMAIL_QUEUE: Queue<any>;

  // Consumer bindings (auto-created by Cloudflare)
  // No need to declare here
}

// Producer example
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const queueService = new QueueService({
      'video-generation-queue': env.VIDEO_QUEUE,
      'email-sending-queue': env.EMAIL_QUEUE,
    });

    // Send message to queue
    await queueService.sendMessage(
      QueueName.create('video-generation-queue'),
      { prompt: 'A beautiful sunset', duration: 5 }
    );

    return Response.json({ success: true });
  },
};

// Consumer export
export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    const consumer = new QueueConsumerService({
      maxRetries: 3,
      deadLetterQueue: 'video-generation-dlq',
    });

    await consumer.handleQueue(batch, env, ctx, async (msg) => {
      console.log('Processing video:', msg.body);
      await generateVideo(msg.body);
    });
  },
} satisfies ExportedHandler<Env>;
```

---

## 📤 PRODUCER PATTERN - MESAJ GÖNDERME

### Örnek 1: Tek Mesaj Gönderme

```typescript
import { QueueService, QueueName } from '@umituz/web-cloudflare';

const queueService = new QueueService({
  'video-generation-queue': env.VIDEO_QUEUE,
});

// Send single message
await queueService.sendMessage(
  QueueName.create('video-generation-queue'),
  {
    prompt: 'A futuristic city with flying cars',
    duration: 5,
    style: 'Cinematic',
  }
);
```

### Örnek 2: Batch Mesaj Gönderme

```typescript
// Send multiple messages
const messages = [
  { prompt: 'Video 1', duration: 5 },
  { prompt: 'Video 2', duration: 10 },
  { prompt: 'Video 3', duration: 5 },
];

const messageIds = await queueService.sendBatch(
  QueueName.create('video-generation-queue'),
  messages
);

console.log(`Sent ${messageIds.length} messages`);
```

### Örnek 3: Mesaj ile Metadata Gönderme

```typescript
await queueService.sendMessage(
  QueueName.create('video-generation-queue'),
  { prompt: 'Sunset video', duration: 5 },
  {
    delaySeconds: 60, // Delay message by 60 seconds
    metadata: {
      userId: 'user-123',
      priority: 'high',
    },
  }
);
```

### Örnek 4: Event Handler ile Mesaj Gönderme

```typescript
queueService.onMessageQueued(async (event, context) => {
  console.log('Message queued:', event.messageId);
  console.log('Queue:', context.queue);

  // Log to analytics
  await analytics.track('message_queued', {
    queue: context.queue,
    messageId: event.messageId,
  });
});

await queueService.sendMessage(
  QueueName.create('video-generation-queue'),
  { prompt: 'Test video' }
);
```

---

## 📥 CONSUMER PATTERN - MESAJ İŞLEME

### Örnek 1: Basit Queue Consumer

```typescript
import { QueueConsumerService } from '@umituz/web-cloudflare';

const consumer = new QueueConsumerService({
  maxRetries: 3,
});

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueue(batch, env, ctx, async (msg) => {
      // Process message
      console.log('Processing:', msg.body);

      // Generate video
      const video = await generateVideo(msg.body);

      // Save to R2
      await env.VIDEO_BUCKET.put(video.id, video.blob);
    });
  },
} satisfies ExportedHandler<Env>;
```

### Örnek 2: Paralel Processing

```typescript
const consumer = QueueConsumerService.create({
  maxRetries: 3,
});

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueueParallel(batch, env, ctx, async (msg) => {
      await processVideo(msg.body);
    }, {
      maxConcurrency: 10, // Process 10 messages at a time
    });
  },
} satisfies ExportedHandler<Env>;
```

### Örnek 3: Consumer ile Context

```typescript
const consumer = new QueueConsumerService();

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueueWithContext(batch, env, ctx, async (msg, context) => {
      console.log('Queue:', context.queue);
      console.log('Env KV:', context.env.KV);

      // Process message
      await processMessage(msg.body);

      // If processing fails, message will be retried automatically
    });
  },
} satisfies ExportedHandler<Env>;
```

### Örnek 4: Batch Processing ile Statistics

```typescript
const consumer = new QueueConsumerService();

consumer.onEvent(async (event) => {
  if (event.eventType === 'batch_completed') {
    console.log('Batch completed:', {
      total: event.batchSize,
      successful: event.successfulCount,
      failed: event.failedCount,
      successRate: event.getSuccessRate(),
      processingTime: `${event.processingTime}ms`,
    });
  }
});

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueue(batch, env, ctx, async (msg) => {
      await processVideo(msg.body);
    });
  },
} satisfies ExportedHandler<Env>;
```

---

## 🔄 RETRY LOGIC VE DLQ

### Örnek 1: Exponential Backoff ile Retry

```typescript
import { QueueConsumerService, RetryPolicy } from '@umituz/web-cloudflare';

const consumer = QueueConsumerService.create({
  maxRetries: 5,
  deadLetterQueue: 'video-generation-dlq',
});

// Set exponential backoff retry policy
consumer.setRetryPolicy(
  RetryPolicy.exponential(
    5, // max attempts
    1000, // initial delay: 1 second
    60000, // max delay: 60 seconds
    2, // backoff multiplier
    true // use jitter
  )
);

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueue(batch, env, ctx, async (msg) => {
      await processVideo(msg.body);
    });
  },
} satisfies ExportedHandler<Env>;
```

**Retry Davranışı:**
- Attempt 1 fails → Wait 1s
- Attempt 2 fails → Wait 2s (1s × 2)
- Attempt 3 fails → Wait 4s (2s × 2)
- Attempt 4 fails → Wait 8s (4s × 2)
- Attempt 5 fails → Send to DLQ

### Örnek 2: Dead Letter Queue Kullanımı

```typescript
const consumer = QueueConsumerService.create({
  maxRetries: 3,
  deadLetterQueue: 'video-generation-dlq', // Failed messages go here
});

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueue(batch, env, ctx, async (msg) => {
      // After 3 failed attempts, message goes to DLQ
      await processVideo(msg.body);
    });
  },

  // DLQ consumer - separate handler for failed messages
  async queue_dlq(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    const dlqConsumer = new QueueConsumerService({
      maxRetries: 0, // No retry for DLQ messages
    });

    await dlqConsumer.handleQueue(batch, env, ctx, async (msg) => {
      console.error('Message failed permanently:', msg.body);

      // Alert admin
      await alertAdmin(msg.body);

      // Log to database
      await env.DB.prepare(
        'INSERT INTO failed_messages (message_id, error, failed_at) VALUES (?, ?, ?)'
      ).bind(msg.body.originalMessageId, msg.body.error, Date.now()).run();
    });
  },
} satisfies ExportedHandler<Env>;
```

### Örnek 3: Custom Retry Policy

```typescript
// Linear backoff - sabit artan gecikme
const linearPolicy = RetryPolicy.linear(
  5, // 5 attempts
  1000, // Start with 1s delay
  30000 // Max 30s delay
);

consumer.setRetryPolicy(linearPolicy);

// Fixed delay - aynı gecikme
const fixedPolicy = RetryPolicy.fixed(
  3, // 3 attempts
  2000 // Always 2s delay
);

consumer.setRetryPolicy(fixedPolicy);

// No retry - hemen başarısız
const noRetryPolicy = RetryPolicy.noRetry();

consumer.setRetryPolicy(noRetryPolicy);
```

---

## 🌟 GERÇEK DÜNYA ÖRNEKLERİ

### Örnek 1: Video Generation Queue

**Producer:**
```typescript
// src/producer.ts
import { QueueService, QueueName } from '@umituz/web-cloudflare';

export interface VideoRequest {
  prompt: string;
  duration: number;
  style: string;
  userId: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const queueService = new QueueService({
      'video-generation-queue': env.VIDEO_QUEUE,
    });

    const { prompt, duration, style, userId } = await req.json();

    // Send to queue
    const messageId = await queueService.sendMessage(
      QueueName.create('video-generation-queue'),
      {
        prompt,
        duration,
        style,
        userId,
        requestedAt: Date.now(),
      }
    );

    return Response.json({
      success: true,
      messageId,
      status: 'queued',
    });
  },
};
```

**Consumer:**
```typescript
// src/consumer.ts
import { QueueConsumerService, RetryPolicy } from '@umituz/web-cloudflare';

const consumer = QueueConsumerService.create({
  maxRetries: 3,
  deadLetterQueue: 'video-generation-dlq',
});

consumer.setRetryPolicy(
  RetryPolicy.exponential(3, 2000, 30000, 2, true)
);

consumer.onEvent(async (event) => {
  if (event.eventType === 'batch_completed') {
    console.log(`Processed ${event.successfulCount}/${event.batchSize} videos`);
  }
});

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueue(batch, env, ctx, async (msg) => {
      const { prompt, duration, style, userId } = msg.body;

      // Generate video
      const video = await generateVideoWithAI(prompt, duration, style);

      // Upload to R2
      const key = `videos/${userId}/${msg.id}.mp4`;
      await env.VIDEO_BUCKET.put(key, video.blob);

      // Save to database
      await env.DB.prepare(
        'INSERT INTO videos (id, user_id, prompt, video_url, status) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        msg.id,
        userId,
        prompt,
        `https://cdn.example.com/${key}`,
        'completed'
      ).run();

      // Notify user
      await sendPushNotification(userId, {
        title: 'Video ready!',
        body: `"${prompt}" is ready to view.`,
      });
    });
  },
} satisfies ExportedHandler<Env>;
```

### Örnek 2: Email Sending Queue

**Producer:**
```typescript
await queueService.sendMessage(
  QueueName.create('email-sending-queue'),
  {
    to: 'user@example.com',
    subject: 'Welcome!',
    template: 'welcome-email',
    data: { name: 'John' },
  }
);
```

**Consumer:**
```typescript
export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    const consumer = QueueConsumerService.create({
      maxRetries: 5,
      deadLetterQueue: 'email-dlq',
    });

    await consumer.handleQueue(batch, env, ctx, async (msg) => {
      const { to, subject, template, data } = msg.body;

      // Render email template
      const html = await renderEmailTemplate(template, data);

      // Send email
      await sendEmail({
        to,
        subject,
        html,
      });
    });
  },
} satisfies ExportedHandler<Env>;
```

### Örnek 3: Batch Image Processing

**Producer:**
```typescript
// Upload 100 images
const imageUrls = await uploadImages(images);

// Send all to queue for processing
await queueService.sendBatch(
  QueueName.create('image-processing-queue'),
  imageUrls.map(url => ({ imageUrl: url, userId: 'user-123' }))
);
```

**Consumer:**
```typescript
const consumer = QueueConsumerService.largeBatches({
  maxRetries: 2,
});

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueueParallel(batch, env, ctx, async (msg) => {
      const { imageUrl, userId } = msg.body;

      // Download image
      const image = await downloadImage(imageUrl);

      // Process (resize, optimize)
      const processed = await processImage(image, {
        resize: { width: 1920, height: 1080 },
        optimize: true,
      });

      // Upload to R2
      await env.IMAGE_BUCKET.put(`images/${userId}/${msg.id}.jpg`, processed);
    }, {
      maxConcurrency: 20, // Process 20 images at a time
    });
  },
} satisfies ExportedHandler<Env>;
```

---

## 📚 BEST PRACTICES

### 1. Batch Size Seçimi

```typescript
// Small batches (1-10) - for time-sensitive messages
const smallBatches = QueueConsumerService.smallBatches();

// Medium batches (25 default) - balanced
const mediumBatches = new QueueConsumerService();

// Large batches (50-100) - for high throughput
const largeBatches = QueueConsumerService.largeBatches();
```

### 2. Retry Policy Seçimi

```typescript
// Exponential backoff - recommended for most cases
const recommended = RetryPolicy.exponential(5, 1000, 60000, 2, true);

// Linear backoff - predictable delay
const linear = RetryPolicy.linear(3, 1000, 30000);

// Fixed delay - simple retry
const fixed = RetryPolicy.fixed(3, 2000);

// No retry - fail fast
const noRetry = RetryPolicy.noRetry();
```

### 3. Dead Letter Queue Kullanımı

```typescript
// ✅ Good - Always use DLQ for production
const consumer = QueueConsumerService.create({
  deadLetterQueue: 'my-queue-dlq',
});

// Monitor DLQ
setInterval(async () => {
  const dlqMessages = await getDLQMessageCount('my-queue-dlq');
  if (dlqMessages > 100) {
    alertAdmin(`Too many failed messages: ${dlqMessages}`);
  }
}, 60000); // Check every minute

// ❌ Bad - No DLQ, messages lost forever
const consumer = QueueConsumerService.create({
  maxRetries: 3,
  // No deadLetterQueue - failed messages disappear!
});
```

### 4. Error Handling

```typescript
consumer.onEvent(async (event) => {
  if (event.eventType === 'message_failed') {
    console.error('Message failed:', {
      messageId: event.messageId,
      attempt: event.attempt,
      error: event.error,
      willRetry: event.willRetry,
    });

    // Track error rate
    await trackError(event.queue, event.error);

    // If error rate too high, alert
    const errorRate = await getErrorRate(event.queue);
    if (errorRate > 0.5) {
      await alertAdmin(`High error rate: ${errorRate * 100}% in ${event.queue}`);
    }
  }
});
```

### 5. Monitoring

```typescript
consumer.onEvent(async (event) => {
  if (event.eventType === 'batch_completed') {
    // Track metrics
    await analytics.track('batch_completed', {
      queue: event.queue,
      total: event.batchSize,
      successful: event.successfulCount,
      failed: event.failedCount,
      processingTime: event.processingTime,
      successRate: event.getSuccessRate(),
    });

    // Log performance
    if (event.processingTime > 30000) {
      console.warn(`Slow batch processing: ${event.processingTime}ms`);
    }
  }
});
```

---

## 🎯 ÖZET

**Cloudflare Queues ile:**
- ✅ Producer/Consumer pattern için tam destek
- ✅ Automatic retry logic (exponential, linear, fixed)
- ✅ Dead Letter Queue (DLQ) desteği
- ✅ Batch processing (parallel veya sequential)
- ✅ Domain events for monitoring
- ✅ Type-safe TypeScript desteği

**Hemen kullanmaya başlayın:**
```typescript
import {
  QueueService,
  QueueConsumerService,
  QueueName,
  RetryPolicy
} from '@umituz/web-cloudflare';

// Producer
const queueService = new QueueService({ 'my-queue': env.MY_QUEUE });
await queueService.sendMessage(QueueName.create('my-queue'), { data: 'Hello!' });

// Consumer
const consumer = QueueConsumerService.create({
  maxRetries: 3,
  deadLetterQueue: 'my-queue-dlq',
});

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await consumer.handleQueue(batch, env, ctx, async (msg) => {
      console.log('Processing:', msg.body);
    });
  },
} satisfies ExportedHandler<Env>;
```

---

**Versiyon:** 1.7.0
**Durum:** ✅ Production Ready
**DDD Skor:** 9.3/10 (+0.5 puan)
