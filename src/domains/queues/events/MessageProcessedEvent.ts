/**
 * Message Processed Event
 * @description Domain event fired when a message is successfully processed
 */

import type { QueueMessage } from '../types';

export class MessageProcessedEvent {
  readonly eventType = 'message_processed' as const;
  readonly queue: string;
  readonly timestamp: number;
  readonly messageId: string;
  readonly processingTime: number;
  readonly result?: unknown;
  readonly metadata?: Record<string, unknown>;

  constructor(
    queue: string,
    message: QueueMessage,
    processingTime: number,
    result?: unknown,
    metadata?: Record<string, unknown>
  ) {
    this.queue = queue;
    this.messageId = message.id;
    this.processingTime = processingTime;
    this.result = result;
    this.timestamp = Date.now();
    this.metadata = metadata;
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      eventType: this.eventType,
      queue: this.queue,
      timestamp: this.timestamp,
      messageId: this.messageId,
      processingTime: this.processingTime,
      result: this.result,
      metadata: this.metadata,
    };
  }

  /**
   * Create event from queue and message
   */
  static create(
    queue: string,
    message: QueueMessage,
    processingTime: number,
    result?: unknown,
    metadata?: Record<string, unknown>
  ): MessageProcessedEvent {
    return new MessageProcessedEvent(queue, message, processingTime, result, metadata);
  }
}
