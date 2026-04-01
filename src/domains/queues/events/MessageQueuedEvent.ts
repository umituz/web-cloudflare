/**
 * Message Queued Event
 * @description Domain event fired when a message is successfully queued
 */

import type { QueueMessage } from '../types';

export class MessageQueuedEvent {
  readonly eventType = 'message_queued' as const;
  readonly queue: string;
  readonly timestamp: number;
  readonly messageId: string;
  readonly body: unknown;
  readonly metadata?: Record<string, unknown>;

  constructor(
    queue: string,
    message: QueueMessage,
    metadata?: Record<string, unknown>
  ) {
    this.queue = queue;
    this.messageId = message.id;
    this.body = message.body;
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
      body: this.body,
      metadata: this.metadata,
    };
  }

  /**
   * Create event from queue and message
   */
  static create(
    queue: string,
    message: QueueMessage,
    metadata?: Record<string, unknown>
  ): MessageQueuedEvent {
    return new MessageQueuedEvent(queue, message, metadata);
  }
}
