/**
 * Cloudflare Queues Domain
 * @description Producer/consumer pattern for Cloudflare Queues with retry logic and DLQ support
 */

// Services
export {
  QueueService,
  QueueBatchProcessor,
  QueueConsumerService,
  queueService,
} from './services';

export type { ProcessResult, BatchProcessResult } from './services';

// Value Objects
export { QueueName } from './value-objects/QueueName';
export { BatchSize } from './value-objects/BatchSize';
export { RetryPolicy } from './value-objects/RetryPolicyValueObject';

// Events
export { MessageQueuedEvent } from './events/MessageQueuedEvent';
export { MessageProcessedEvent } from './events/MessageProcessedEvent';
export { MessageFailedEvent } from './events/MessageFailedEvent';
export { BatchCompletedEvent } from './events/BatchCompletedEvent';

// Types
export type {
  QueueMessage,
  MessageBatch,
  QueueConsumerConfig,
  QueueProducerConfig,
  QueueStats,
  RetryPolicy as RetryPolicyType,
  RetryResult,
  MessageHandler,
  MessageHandlerWithContext,
  QueueHandlerContext,
  QueueEvent,
  MessageQueuedEvent as MessageQueuedEventType,
  MessageProcessedEvent as MessageProcessedEventType,
  MessageFailedEvent as MessageFailedEventType,
  BatchCompletedEvent as BatchCompletedEventType,
} from './types';
