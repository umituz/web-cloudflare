/**
 * Queue Consumer Service
 * @description Consumer service utilities for Cloudflare Queues
 */

import type {
  MessageBatch,
  MessageHandlerWithContext,
  QueueConsumerConfig,
  QueueHandlerContext,
} from '../types';
import { BatchSize } from '../value-objects/BatchSize';
import { QueueBatchProcessor } from './QueueBatchProcessor';

export class QueueConsumerService {
  private config: QueueConsumerConfig;
  private processor: QueueBatchProcessor;

  constructor(config?: QueueConsumerConfig) {
    this.config = {
      batchSize: config?.batchSize || 25,
      maxWaitTime: config?.maxWaitTime || 10,
      maxRetries: config?.maxRetries || 3,
      deadLetterQueue: config?.deadLetterQueue,
      messageTimeout: config?.messageTimeout || 30,
      visibilityTimeout: config?.visibilityTimeout || 30,
    };

    this.processor = QueueBatchProcessor.withExponentialBackoff(
      this.config.maxRetries,
      1000
    );
  }

  /**
   * Create a queue handler for Worker export
   * @param handler Message handler function
   * @param options Handler options
   * @returns Queue handler function for Worker export
   *
   * @example
   * ```typescript
   * const consumerService = new QueueConsumerService();
   *
   * export default {
   *   async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
   *     await consumerService.handleQueue(batch, env, ctx, async (msg) => {
   *       console.log('Processing:', msg.body);
   *       await processVideo(msg.body);
   *     });
   *   }
   * } satisfies ExportedHandler<Env>;
   * ```
   */
  async handleQueue<T = unknown>(
    batch: MessageBatch,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
    handler: (msg: import('../types').QueueMessage<T>) => Promise<void> | void
  ): Promise<void> {
    const messages = batch.messages;
    const queueName = batch.queue;

    // Process batch
    const result = await this.processor.processBatch(
      messages,
      async (msg) => {
        // Call user handler
        await handler(msg as import('../types').QueueMessage<T>);
      },
      { queueName, parallel: false }
    );

    // Handle failed messages
    if (result.failed > 0 && this.config.deadLetterQueue) {
      await this.sendToDeadLetterQueue(result.results, env, queueName);
    }

    // Acknowledge successful messages
    // Note: Cloudflare Queues automatically acknowledges messages on successful execution
    // Failed messages will be retried based on retry policy
  }

  /**
   * Create a queue handler with parallel processing
   * @param handler Message handler function
   * @param options Handler options
   * @returns Queue handler function for Worker export
   */
  async handleQueueParallel<T = unknown>(
    batch: MessageBatch,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
    handler: (msg: import('../types').QueueMessage<T>) => Promise<void> | void,
    options?: {
      maxConcurrency?: number;
    }
  ): Promise<void> {
    const messages = batch.messages;
    const queueName = batch.queue;

    // Process batch in parallel
    const result = await this.processor.processBatch(
      messages,
      async (msg) => {
        await handler(msg as import('../types').QueueMessage<T>);
      },
      {
        queueName,
        parallel: true,
        maxConcurrency: options?.maxConcurrency || 10,
      }
    );

    // Handle failed messages
    if (result.failed > 0 && this.config.deadLetterQueue) {
      await this.sendToDeadLetterQueue(result.results, env, queueName);
    }
  }

  /**
   * Create handler with context
   * @param handler Message handler with context
   * @returns Queue handler function for Worker export
   */
  async handleQueueWithContext<T = unknown>(
    batch: MessageBatch,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
    handler: MessageHandlerWithContext<T>
  ): Promise<void> {
    const messages = batch.messages;
    const queueName = batch.queue;

    // Create queue handler context
    const context: QueueHandlerContext = {
      queue: queueName,
      env: env as QueueHandlerContext['env'],
      ctx: {
        waitUntil: ctx.waitUntil.bind(ctx),
        passThroughOnException: ctx.passThroughOnException?.bind(ctx),
      },
      retry: () => {
        // Message will be retried by throwing an error
        throw new Error('Retry requested');
      },
      ack: () => {
        // Message is acknowledged by completing successfully
        // No action needed
      },
    };

    // Process each message with context
    for (const message of messages) {
      try {
        await handler(message as import('../types').QueueMessage<T>, context);
      } catch (error) {
        // Error will trigger retry based on retry policy
        if ((error as Error).message === 'Retry requested') {
          throw error; // Explicit retry request
        }
        // Other errors will also trigger retry
        throw error;
      }
    }
  }

  /**
   * Send failed messages to dead letter queue
   * @private
   */
  private async sendToDeadLetterQueue(
    results: import('./QueueBatchProcessor').ProcessResult[],
    env: Record<string, unknown>,
    queueName: string
  ): Promise<void> {
    const dlqName = this.config.deadLetterQueue!;

    // Check if DLQ exists in bindings
    const queues = env.QUEUE as Record<string, Queue> | undefined;
    if (!queues || !queues[dlqName]) {
      console.warn(`Dead letter queue "${dlqName}" not found in bindings`);
      return;
    }

    const dlq = queues[dlqName];

    // Send failed messages to DLQ
    for (const result of results) {
      if (!result.success) {
        try {
          await dlq.send({
            originalMessageId: result.messageId,
            originalQueue: queueName,
            error: result.error?.message,
            retryCount: result.retryCount,
            failedAt: Date.now(),
          });
        } catch (error) {
          console.error(`Failed to send message ${result.messageId} to DLQ:`, error);
        }
      }
    }
  }

  /**
   * Get consumer configuration
   */
  getConfig(): QueueConsumerConfig {
    return { ...this.config };
  }

  /**
   * Set consumer configuration
   * @param config New configuration
   */
  setConfig(config: Partial<QueueConsumerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get batch size as value object
   */
  getBatchSize(): BatchSize {
    return new BatchSize(this.config.batchSize || 25);
  }

  /**
   * Set batch size
   * @param size New batch size
   */
  setBatchSize(size: number): void {
    this.config.batchSize = size;
  }

  /**
   * Get retry policy
   */
  getRetryPolicy(): import('../value-objects/RetryPolicyValueObject').RetryPolicy {
    return this.processor.getRetryPolicy();
  }

  /**
   * Set retry policy
   * @param policy New retry policy
   */
  setRetryPolicy(
    policy: import('../value-objects/RetryPolicyValueObject').RetryPolicy
  ): void {
    this.processor.setRetryPolicy(policy);
  }

  /**
   * Create consumer service with configuration
   * @param config Consumer configuration
   * @returns Queue consumer service
   *
   * @example
   * ```typescript
   * const consumer = QueueConsumerService.create({
   *   batchSize: 50,
   *   maxRetries: 5,
   *   deadLetterQueue: 'my-queue-dlq',
   * });
   * ```
   */
  static create(config?: QueueConsumerConfig): QueueConsumerService {
    return new QueueConsumerService(config);
  }

  /**
   * Create consumer service for small batches
   */
  static smallBatches(config?: Omit<QueueConsumerConfig, 'batchSize'>): QueueConsumerService {
    return new QueueConsumerService({
      ...config,
      batchSize: 10,
    });
  }

  /**
   * Create consumer service for large batches
   */
  static largeBatches(config?: Omit<QueueConsumerConfig, 'batchSize'>): QueueConsumerService {
    return new QueueConsumerService({
      ...config,
      batchSize: 100,
    });
  }
}
