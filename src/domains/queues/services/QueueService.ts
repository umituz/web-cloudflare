/**
 * Queue Service
 * @description Producer service for sending messages to Cloudflare Queues
 */

import type { Queue } from '@cloudflare/workers-types';
import { QueueName } from '../value-objects/QueueName';
import type {
  QueueMessage,
  QueueProducerConfig,
  MessageHandlerWithContext,
} from '../types';
import { MessageQueuedEvent } from '../events/MessageQueuedEvent';

export class QueueService {
  private queues: Record<string, Queue>;
  private config: QueueProducerConfig;
  private eventHandlers?: Map<string, MessageHandlerWithContext<MessageQueuedEvent>>;

  constructor(
    queues: Record<string, Queue>,
    config: QueueProducerConfig = {}
  ) {
    this.queues = queues;
    this.config = {
      messageTTL: config.messageTTL || 86400, // 24 hours default
      deliveryDelay: config.deliveryDelay || 0,
      contentBasedDeduplication: config.contentBasedDeduplication || false,
    };
  }

  /**
   * Send a single message to a queue
   * @param queueName Queue name
   * @param body Message body
   * @param options Optional message options
   * @returns Message ID
   */
  async sendMessage<T = unknown>(
    queueName: QueueName | string,
    body: T,
    options?: {
      id?: string;
      delaySeconds?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const name = queueName instanceof QueueName ? queueName.getValue() : queueName;
    const queue = this.queues[name];

    if (!queue) {
      throw new Error(`Queue "${name}" not found in bindings`);
    }

    // Generate message ID
    const messageId = options?.id || this.generateId();

    // Create message
    const message: QueueMessage<T> = {
      id: messageId,
      body,
      timestamp: Date.now(),
      metadata: options?.metadata,
    };

    // Send to queue
    await queue.send(message.body, {
      contentType: 'json',
    });

    // Emit event
    await this.emitEvent(name, new MessageQueuedEvent(name, message, options?.metadata));

    return messageId;
  }

  /**
   * Send multiple messages to a queue (batch send)
   * @param queueName Queue name
   * @param messages Array of message bodies
   * @param options Optional message options
   * @returns Array of message IDs
   */
  async sendBatch<T = unknown>(
    queueName: QueueName | string,
    messages: T[],
    options?: {
      delaySeconds?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string[]> {
    const name = queueName instanceof QueueName ? queueName.getValue() : queueName;
    const queue = this.queues[name];

    if (!queue) {
      throw new Error(`Queue "${name}" not found in bindings`);
    }

    if (messages.length === 0) {
      return [];
    }

    // Send all messages
    const messageIds: string[] = [];
    for (const body of messages) {
      const messageId = await this.sendMessage(name, body, options);
      messageIds.push(messageId);
    }

    return messageIds;
  }

  /**
   * Configure event handler for queued messages
   * @param handler Event handler function
   */
  onMessageQueued(handler: MessageHandlerWithContext<MessageQueuedEvent>): void {
    if (!this.eventHandlers) {
      this.eventHandlers = new Map();
    }
    this.eventHandlers.set('message_queued', handler);
  }

  /**
   * Get queue configuration
   */
  getConfig(): QueueProducerConfig {
    return { ...this.config };
  }

  /**
   * Check if a queue exists in bindings
   * @param queueName Queue name
   * @returns True if queue exists
   */
  hasQueue(queueName: QueueName | string): boolean {
    const name = queueName instanceof QueueName ? queueName.getValue() : queueName;
    return name in this.queues;
  }

  /**
   * Get list of available queue names
   * @returns Array of queue names
   */
  getAvailableQueues(): string[] {
    return Object.keys(this.queues);
  }

  /**
   * Emit event to registered handlers
   * @private
   */
  private async emitEvent(queueName: string, event: MessageQueuedEvent): Promise<void> {
    if (this.eventHandlers?.has('message_queued')) {
      const handler = this.eventHandlers.get('message_queued')!;
      await handler(event, {
        queue: queueName,
        env: {},
        ctx: {
          waitUntil: () => {},
        },
        retry: () => {},
        ack: () => {},
      });
    }
  }

  /**
   * Generate unique message ID
   * @private
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create QueueService from environment bindings
   * @param env Environment bindings with QUEUE property
   * @param config Optional configuration
   * @returns QueueService instance
   *
   * @example
   * ```typescript
   * export interface Env {
   *   QUEUE: Record<string, Queue>;
   * }
   *
   * const queueService = QueueService.fromBindings(env.QUEUE);
   * await queueService.sendMessage('my-queue', { data: 'Hello!' });
   * ```
   */
  static fromBindings(
    queues: Record<string, Queue>,
    config?: QueueProducerConfig
  ): QueueService {
    return new QueueService(queues, config);
  }
}

// ============================================================
// Singleton Instance (for backward compatibility)
// ============================================================

export const queueService = new QueueService({});
