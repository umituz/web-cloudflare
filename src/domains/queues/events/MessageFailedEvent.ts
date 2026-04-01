/**
 * Message Failed Event
 * @description Domain event fired when a message processing fails
 */

import type { QueueMessage } from '../types';

export class MessageFailedEvent {
  readonly eventType = 'message_failed' as const;
  readonly queue: string;
  readonly timestamp: number;
  readonly messageId: string;
  readonly attempt: number;
  readonly error: string;
  readonly willRetry: boolean;
  readonly metadata?: Record<string, unknown>;

  constructor(
    queue: string,
    message: QueueMessage,
    error: Error,
    willRetry: boolean,
    metadata?: Record<string, unknown>
  ) {
    this.queue = queue;
    this.messageId = message.id;
    this.attempt = message.attempt || 1;
    this.error = error.message;
    this.willRetry = willRetry;
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
      attempt: this.attempt,
      error: this.error,
      willRetry: this.willRetry,
      metadata: this.metadata,
    };
  }

  /**
   * Create event from queue, message, and error
   */
  static create(
    queue: string,
    message: QueueMessage,
    error: Error,
    willRetry: boolean,
    metadata?: Record<string, unknown>
  ): MessageFailedEvent {
    return new MessageFailedEvent(queue, message, error, willRetry, metadata);
  }
}
