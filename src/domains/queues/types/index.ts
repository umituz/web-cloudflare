/**
 * Cloudflare Queues Types
 * @description Type definitions for Queue producer/consumer pattern
 */

// ============================================================
// Message Types
// ============================================================

/**
 * Queue message with metadata
 */
export interface QueueMessage<T = unknown> {
  /** Unique message ID */
  id: string;

  /** Message body/payload */
  body: T;

  /** Message timestamp */
  timestamp: number;

  /** Number of retry attempts */
  attempt?: number;

  /** Optional message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message batch from Queue consumer
 */
export interface MessageBatch {
  /** Queue name */
  queue: string;

  /** Messages in the batch */
  messages: QueueMessage[];

  /** Retry all messages in batch */
  retryAll(): void;

  /** Acknowledge all messages in batch */
  ackAll(): void;
}

// ============================================================
// Queue Types
// ============================================================

/**
 * Queue consumer configuration
 */
export interface QueueConsumerConfig {
  /** Maximum batch size */
  batchSize?: number;

  /** Maximum wait time for batch (seconds) */
  maxWaitTime?: number;

  /** Maximum number of retries */
  maxRetries?: number;

  /** Dead letter queue name */
  deadLetterQueue?: string;

  /** Message handler timeout (seconds) */
  messageTimeout?: number;

  /** Visibility timeout (seconds) */
  visibilityTimeout?: number;
}

/**
 * Queue producer configuration
 */
export interface QueueProducerConfig {
  /** Default message TTL (seconds) */
  messageTTL?: number;

  /** Default delivery delay (seconds) */
  deliveryDelay?: number;

  /** Enable content-based deduplication */
  contentBasedDeduplication?: boolean;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Approximate number of messages in queue */
  approximateMessageCount?: number;

  /** Approximate number of messages not visible (in flight) */
  approximateNotVisibleCount?: number;

  /** Number of messages delayed */
  delayedMessageCount?: number;

  /** Queue creation timestamp */
  createdAt?: number;

  /** Queue last modified timestamp */
  modifiedAt?: number;
}

// ============================================================
// Retry Types
// ============================================================

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;

  /** Initial delay before first retry (milliseconds) */
  initialDelay: number;

  /** Maximum delay between retries (milliseconds) */
  maxDelay: number;

  /** Backoff multiplier */
  backoffMultiplier: number;

  /** Whether to use jitter */
  useJitter: boolean;

  /** Retry strategy */
  strategy: 'fixed' | 'linear' | 'exponential';
}

/**
 * Retry result
 */
export interface RetryResult {
  /** Whether the retry was successful */
  success: boolean;

  /** Number of attempts made */
  attempts: number;

  /** Last error */
  error?: Error;

  /** Total delay time (milliseconds) */
  totalDelay: number;
}

// ============================================================
// Handler Types
// ============================================================

/**
 * Message handler function
 */
export type MessageHandler<T = unknown> = (
  message: QueueMessage<T>
) => Promise<void> | void;

/**
 * Async message handler with context
 */
export type MessageHandlerWithContext<T = unknown> = (
  message: QueueMessage<T>,
  context: QueueHandlerContext
) => Promise<void> | void;

/**
 * Queue handler context
 */
export interface QueueHandlerContext {
  /** Queue name */
  queue: string;

  /** Environment bindings */
  env: {
    KV?: KVNamespace;
    R2?: R2Bucket;
    D1?: D1Database;
    [key: string]: unknown;
  };

  /** Execution context */
  ctx: {
    waitUntil: (promise: Promise<unknown>) => void;
    passThroughOnException?: () => void;
  };

  /** Retry the message */
  retry: () => void;

  /** Acknowledge the message */
  ack: () => void;
}

// ============================================================
// Event Types
// ============================================================

/**
 * Queue event base type
 */
export interface QueueEvent {
  type: 'message_queued' | 'message_processed' | 'message_failed' | 'batch_completed';
  queue: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Message queued event
 */
export interface MessageQueuedEvent extends QueueEvent {
  type: 'message_queued';
  messageId: string;
  body: unknown;
}

/**
 * Message processed event
 */
export interface MessageProcessedEvent extends QueueEvent {
  type: 'message_processed';
  messageId: string;
  processingTime: number;
  result?: unknown;
}

/**
 * Message failed event
 */
export interface MessageFailedEvent extends QueueEvent {
  type: 'message_failed';
  messageId: string;
  attempt: number;
  error: string;
  willRetry: boolean;
}

/**
 * Batch completed event
 */
export interface BatchCompletedEvent extends QueueEvent {
  type: 'batch_completed';
  batchSize: number;
  successfulCount: number;
  failedCount: number;
  processingTime: number;
}

// ============================================================
// Export Types
// ============================================================

export type {
  QueueMessage,
  MessageBatch,
  QueueConsumerConfig,
  QueueProducerConfig,
  QueueStats,
  RetryPolicy,
  RetryResult,
  MessageHandler,
  MessageHandlerWithContext,
  QueueHandlerContext,
};
