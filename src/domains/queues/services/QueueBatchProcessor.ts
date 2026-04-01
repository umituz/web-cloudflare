/**
 * Queue Batch Processor
 * @description Helper service for processing message batches with retry logic and error handling
 */

import type { QueueMessage } from '../types';
import { RetryPolicy } from '../value-objects/RetryPolicyValueObject';
import { MessageProcessedEvent } from '../events/MessageProcessedEvent';
import { MessageFailedEvent } from '../events/MessageFailedEvent';
import { BatchCompletedEvent } from '../events/BatchCompletedEvent';

export interface ProcessResult {
  success: boolean;
  messageId: string;
  error?: Error;
  processingTime: number;
  retryCount: number;
}

export interface BatchProcessResult {
  total: number;
  successful: number;
  failed: number;
  results: ProcessResult[];
  processingTime: number;
}

export class QueueBatchProcessor {
  private retryPolicy: RetryPolicy;
  private eventHandlers?: Map<
    string,
    (event: MessageProcessedEvent | MessageFailedEvent | BatchCompletedEvent) => Promise<void> | void
  >;

  constructor(retryPolicy?: RetryPolicy) {
    this.retryPolicy = retryPolicy || RetryPolicy.default();
  }

  /**
   * Process a single message with retry logic
   * @param message Queue message
   * @param handler Message handler function
   * @returns Process result
   */
  async processMessage<T = unknown>(
    message: QueueMessage<T>,
    handler: (msg: QueueMessage<T>) => Promise<void> | void,
    queueName?: string
  ): Promise<ProcessResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    const attempt = (message.attempt || 0) + 1;

    // Process message with retry
    while (attempt <= this.retryPolicy.getMaxAttempts()) {
      try {
        await handler(message);

        const processingTime = Date.now() - startTime;

        // Emit success event
        await this.emitEvent(
          new MessageProcessedEvent(
            queueName || 'unknown',
            message,
            processingTime
          )
        );

        return {
          success: true,
          messageId: message.id,
          processingTime,
          retryCount: attempt - 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if should retry
        if (attempt < this.retryPolicy.getMaxAttempts()) {
          const delay = this.retryPolicy.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    const processingTime = Date.now() - startTime;

    // Emit failure event
    await this.emitEvent(
      new MessageFailedEvent(
        queueName || 'unknown',
        message,
        lastError!,
        false // No more retries
      )
    );

    return {
      success: false,
      messageId: message.id,
      error: lastError,
      processingTime,
      retryCount: attempt - 1,
    };
  }

  /**
   * Process a batch of messages
   * @param messages Array of queue messages
   * @param handler Message handler function
   * @param options Processing options
   * @returns Batch process result
   */
  async processBatch<T = unknown>(
    messages: QueueMessage<T>[],
    handler: (msg: QueueMessage<T>) => Promise<void> | void,
    options?: {
      queueName?: string;
      parallel?: boolean;
      maxConcurrency?: number;
    }
  ): Promise<BatchProcessResult> {
    const startTime = Date.now();
    const results: ProcessResult[] = [];

    if (options?.parallel) {
      // Process messages in parallel with concurrency limit
      const concurrency = options.maxConcurrency || 10;
      const chunks = this.chunkArray(messages, concurrency);

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map((msg) => this.processMessage(msg, handler, options?.queueName))
        );
        results.push(...chunkResults);
      }
    } else {
      // Process messages sequentially
      for (const message of messages) {
        const result = await this.processMessage(message, handler, options?.queueName);
        results.push(result);
      }
    }

    const processingTime = Date.now() - startTime;
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Emit batch completion event
    await this.emitEvent(
      new BatchCompletedEvent(
        options?.queueName || 'unknown',
        results.length,
        successful,
        failed,
        processingTime
      )
    );

    return {
      total: results.length,
      successful,
      failed,
      results,
      processingTime,
    };
  }

  /**
   * Process messages with automatic retry on failure
   * @param messages Array of queue messages
   * @param handler Message handler function
   * @param options Processing options
   * @returns Batch process result
   */
  async processWithRetry<T = unknown>(
    messages: QueueMessage<T>[],
    handler: (msg: QueueMessage<T>) => Promise<void> | void,
    options?: {
      queueName?: string;
      retryPolicy?: RetryPolicy;
    }
  ): Promise<BatchProcessResult> {
    const originalPolicy = this.retryPolicy;

    if (options?.retryPolicy) {
      this.retryPolicy = options.retryPolicy;
    }

    try {
      return await this.processBatch(messages, handler, {
        queueName: options?.queueName,
        parallel: false, // Sequential for retry
      });
    } finally {
      this.retryPolicy = originalPolicy;
    }
  }

  /**
   * Configure event handler
   * @param handler Event handler function
   */
  onEvent(
    handler: (event: MessageProcessedEvent | MessageFailedEvent | BatchCompletedEvent) => Promise<void> | void
  ): void {
    if (!this.eventHandlers) {
      this.eventHandlers = new Map();
    }
    this.eventHandlers.set('all', handler);
  }

  /**
   * Get retry policy
   */
  getRetryPolicy(): RetryPolicy {
    return this.retryPolicy;
  }

  /**
   * Set retry policy
   * @param policy New retry policy
   */
  setRetryPolicy(policy: RetryPolicy): void {
    this.retryPolicy = policy;
  }

  /**
   * Sleep for specified milliseconds
   * @private
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Split array into chunks
   * @private
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Emit event to registered handlers
   * @private
   */
  private async emitEvent(
    event: MessageProcessedEvent | MessageFailedEvent | BatchCompletedEvent
  ): Promise<void> {
    if (this.eventHandlers?.has('all')) {
      const handler = this.eventHandlers.get('all')!;
      await handler(event);
    }
  }

  /**
   * Create processor with exponential backoff (recommended)
   */
  static withExponentialBackoff(
    maxAttempts: number = 5,
    initialDelay: number = 1000
  ): QueueBatchProcessor {
    return new QueueBatchProcessor(
      RetryPolicy.exponential(maxAttempts, initialDelay)
    );
  }

  /**
   * Create processor with fixed delay
   */
  static withFixedDelay(
    maxAttempts: number = 3,
    delay: number = 1000
  ): QueueBatchProcessor {
    return new QueueBatchProcessor(
      RetryPolicy.fixed(maxAttempts, delay)
    );
  }

  /**
   * Create processor without retry
   */
  static withoutRetry(): QueueBatchProcessor {
    return new QueueBatchProcessor(RetryPolicy.noRetry());
  }
}
